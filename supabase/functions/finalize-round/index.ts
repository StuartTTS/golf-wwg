import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  roundId: string;
}

Deno.serve(async (req: Request) => {
  try {
    const { roundId } = (await req.json()) as RequestBody;

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
