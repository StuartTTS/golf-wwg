import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  userId: string;
  roundId: string;
}

Deno.serve(async (req: Request) => {
  try {
    const { userId, roundId } = (await req.json()) as RequestBody;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    if (!roundPlayers || roundPlayers.length < 3) {
      return new Response(
        JSON.stringify({ message: 'Need at least 3 rounds for handicap' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate differentials for each round
    const differentials: { roundId: string; differential: number; date: string }[] = [];

    for (const rp of roundPlayers) {
      const round = rp.rounds as any;
      const teeBox = rp.tee_boxes as any;

      // Get total strokes for this round
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

      // Score Differential = (113 / Slope) * (Adjusted Gross - Course Rating)
      const differential =
        (113 / teeBox.slope_rating) * (totalStrokes - teeBox.course_rating);
      const rounded = Math.round(differential * 10) / 10;

      differentials.push({
        roundId: round.id,
        differential: rounded,
        date: round.round_date,
      });
    }

    if (differentials.length < 3) {
      return new Response(
        JSON.stringify({ message: 'Not enough complete rounds' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine how many differentials to use
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

    // Sort by differential and take the best
    const sorted = [...differentials].sort((a, b) => a.differential - b.differential);
    const used = sorted.slice(0, count);
    const average = used.reduce((sum, d) => sum + d.differential, 0) / used.length;
    const handicapIndex = Math.min(Math.floor((average + adjustment) * 10) / 10, 54.0);

    // Save handicap record
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

    return new Response(
      JSON.stringify({ handicapIndex, differentialsUsed: used.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
