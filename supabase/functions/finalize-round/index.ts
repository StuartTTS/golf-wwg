import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  roundId: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Verify authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { roundId } = (await req.json()) as RequestBody;

    // Create a client with the user's JWT to respect RLS
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the user's identity
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Service role client for actual operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get round details
    const { data: round } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (!round) {
      return new Response(
        JSON.stringify({ error: 'Round not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is round creator or group admin
    const isCreator = round.created_by === user.id;
    let isGroupAdmin = false;
    if (!isCreator) {
      const { data: membership } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', round.group_id)
        .eq('user_id', user.id)
        .single();
      isGroupAdmin = membership?.role === 'admin';
    }

    if (!isCreator && !isGroupAdmin) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to finalize this round' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark round as completed
    await supabase
      .from('rounds')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', roundId);

    // Update all playing players to completed
    await supabase
      .from('round_players')
      .update({ status: 'completed' })
      .eq('round_id', roundId)
      .eq('status', 'playing');

    // Finalize all active games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('round_id', roundId)
      .eq('status', 'active');

    if (games) {
      for (const game of games) {
        await supabase
          .from('games')
          .update({ status: 'finalized' })
          .eq('id', game.id);
      }
    }

    // Trigger handicap recalculation for each player
    // Use the service role Supabase client to invoke the edge function directly
    // instead of making HTTP requests with the service key in headers
    const { data: roundPlayers } = await supabase
      .from('round_players')
      .select('user_id')
      .eq('round_id', roundId);

    if (roundPlayers) {
      for (const rp of roundPlayers) {
        await calculateHandicapForPlayer(supabase, rp.user_id, roundId);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Inline handicap calculation using the service role client.
 * Avoids transmitting the service role key over HTTP.
 */
async function calculateHandicapForPlayer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  roundId: string
) {
  // Get all completed rounds for this user (last 20)
  const { data: roundPlayers } = await supabase
    .from('round_players')
    .select(`
      round_id,
      tee_box_id,
      rounds!inner (
        id,
        round_date,
        status,
        tee_box_id
      ),
      tee_boxes!inner (
        slope_rating,
        course_rating
      )
    `)
    .eq('user_id', userId)
    .eq('rounds.status', 'completed')
    .order('rounds(round_date)', { ascending: false })
    .limit(20);

  if (!roundPlayers || roundPlayers.length < 3) return;

  // Calculate differentials for each round
  const differentials: { roundId: string; differential: number; date: string }[] = [];

  for (const rp of roundPlayers) {
    const round = rp.rounds as any;
    const teeBox = rp.tee_boxes as any;

    const { data: scores } = await supabase
      .from('scores')
      .select('strokes, hole_number')
      .eq('round_id', round.id)
      .eq('player_id', userId)
      .not('strokes', 'is', null);

    if (!scores || scores.length < 18) continue;

    const totalStrokes = scores.reduce(
      (sum: number, s: any) => sum + (s.strokes || 0),
      0
    );

    const differential =
      (113 / teeBox.slope_rating) * (totalStrokes - teeBox.course_rating);
    const rounded = Math.round(differential * 10) / 10;

    differentials.push({
      roundId: round.id,
      differential: rounded,
      date: round.round_date,
    });
  }

  if (differentials.length < 3) return;

  // Determine how many differentials to use (USGA WHS table)
  const n = differentials.length;
  let count: number;
  let adjustment = 0;

  if (n <= 3) { count = 1; adjustment = -2.0; }
  else if (n === 4) { count = 1; adjustment = -1.0; }
  else if (n === 5) { count = 1; }
  else if (n === 6) { count = 2; adjustment = -1.0; }
  else if (n <= 8) { count = 2; }
  else if (n <= 10) { count = 3; }
  else if (n <= 12) { count = 4; }
  else if (n <= 14) { count = 5; }
  else if (n <= 16) { count = 6; }
  else if (n <= 18) { count = 7; }
  else if (n === 19) { count = 8; adjustment = -1.0; }
  else { count = 8; }

  const sorted = [...differentials].sort((a, b) => a.differential - b.differential);
  const used = sorted.slice(0, count);
  const average = used.reduce((sum, d) => sum + d.differential, 0) / used.length;
  const handicapIndex = Math.min(Math.floor((average + adjustment) * 10) / 10, 54.0);

  // Save handicap record (service role bypasses the WITH CHECK (false) policy)
  await supabase.from('handicap_records').insert({
    user_id: userId,
    round_id: roundId,
    handicap_index: handicapIndex,
    differentials_used: used,
  });

  // Update profile
  await supabase
    .from('profiles')
    .update({ current_handicap_index: handicapIndex })
    .eq('id', userId);
}
