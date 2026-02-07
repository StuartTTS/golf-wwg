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

    // Verify user is a participant in this round
    const { data: roundPlayer } = await userClient
      .from('round_players')
      .select('id')
      .eq('round_id', roundId)
      .limit(1)
      .single();

    if (!roundPlayer) {
      return new Response(
        JSON.stringify({ error: 'Not authorized for this round' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Service role client for actual operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all finalized games for this round
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('round_id', roundId)
      .eq('status', 'finalized');

    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No finalized games found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate net balances per player across all games
    const balances: Record<string, number> = {};

    for (const game of games) {
      const results = game.results as any;
      if (!results?.payouts) continue;

      const gamePlayers = (
        await supabase
          .from('game_players')
          .select('player_id')
          .eq('game_id', game.id)
      ).data;

      if (!gamePlayers) continue;

      const numPlayers = gamePlayers.length;
      const totalPot = results.payouts.reduce(
        (sum: number, p: any) => sum + (p.amount || 0),
        0
      );
      const costPerPlayer = totalPot / numPlayers;

      // Each player pays in costPerPlayer
      for (const gp of gamePlayers) {
        balances[gp.player_id] = (balances[gp.player_id] || 0) - costPerPlayer;
      }

      // Winners get their payouts
      for (const payout of results.payouts) {
        balances[payout.playerId] =
          (balances[payout.playerId] || 0) + payout.amount;
      }
    }

    // Simplify debts
    const debtors = Object.entries(balances)
      .filter(([, amt]) => amt < -0.01)
      .map(([id, amt]) => ({ id, amount: Math.abs(amt) }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = Object.entries(balances)
      .filter(([, amt]) => amt > 0.01)
      .map(([id, amt]) => ({ id, amount: amt }))
      .sort((a, b) => b.amount - a.amount);

    const settlements: { payer_id: string; payee_id: string; amount: number }[] = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const payment = Math.min(debtors[i].amount, creditors[j].amount);
      if (payment > 0.01) {
        settlements.push({
          payer_id: debtors[i].id,
          payee_id: creditors[j].id,
          amount: Math.round(payment * 100) / 100,
        });
      }
      debtors[i].amount -= payment;
      creditors[j].amount -= payment;
      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }

    // Insert settlements
    if (settlements.length > 0) {
      const rows = settlements.map((s) => ({
        round_id: roundId,
        payer_id: s.payer_id,
        payee_id: s.payee_id,
        amount: s.amount,
        status: 'pending',
      }));

      await supabase.from('settlements').insert(rows);
    }

    return new Response(
      JSON.stringify({ success: true, settlements }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
