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
    const { data: roundPlayers } = await supabase
      .from('round_players')
      .select('user_id')
      .eq('round_id', roundId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (roundPlayers) {
      for (const rp of roundPlayers) {
        // Call calculate-handicap for each player
        await fetch(`${supabaseUrl}/functions/v1/calculate-handicap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            userId: rp.user_id,
            roundId: roundId,
          }),
        });
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
