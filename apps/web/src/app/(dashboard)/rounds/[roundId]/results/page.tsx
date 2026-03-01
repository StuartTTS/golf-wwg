import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ResultsView from './results-view';

interface ResultsPageProps {
  params: Promise<{ roundId: string }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { roundId } = await params;
  const supabase = await createServerSupabaseClient();

  // Fetch round with players
  const { data: roundData, error: roundError } = await supabase
    .from('rounds')
    .select(`
      id,
      status,
      round_date,
      courses ( name ),
      round_players (
        user_id,
        tee_box_id,
        profiles:profiles!round_players_user_id_fkey ( id, display_name, current_handicap_index )
      )
    `)
    .eq('id', roundId)
    .single();

  if (roundError || !roundData) {
    notFound();
  }

  // Fetch all scores for this round
  const { data: scoresData } = await supabase
    .from('scores')
    .select('player_id, hole_number, strokes')
    .eq('round_id', roundId);

  // Fetch holes info
  const teeBoxId = roundData.round_players[0]?.tee_box_id;
  const { data: holesData } = teeBoxId
    ? await supabase
        .from('holes')
        .select('hole_number, par')
        .eq('tee_box_id', teeBoxId)
        .order('hole_number')
    : { data: [] };

  const holes = holesData ?? [];
  const totalPar = holes.reduce((sum, h) => sum + h.par, 0);

  // Build player results
  const playerResults = roundData.round_players
    .map((rp: any) => {
      const playerScores = (scoresData ?? []).filter(
        (s) => s.player_id === rp.profiles.id
      );
      const frontScores = playerScores.filter((s) => s.hole_number <= 9);
      const backScores = playerScores.filter((s) => s.hole_number > 9);
      const grossTotal = playerScores.reduce(
        (sum, s) => sum + (s.strokes ?? 0),
        0
      );
      const frontNine = frontScores.reduce(
        (sum, s) => sum + (s.strokes ?? 0),
        0
      );
      const backNine = backScores.reduce(
        (sum, s) => sum + (s.strokes ?? 0),
        0
      );
      const handicap = rp.profiles.current_handicap_index ?? 0;
      const netTotal = grossTotal - handicap;

      return {
        playerId: rp.profiles.id,
        displayName: rp.profiles.display_name,
        handicap: rp.profiles.current_handicap_index,
        grossTotal,
        netTotal,
        frontNine,
        backNine,
        toPar: grossTotal - totalPar,
        position: 0,
      };
    })
    .sort((a: any, b: any) => a.grossTotal - b.grossTotal)
    .map((p: any, idx: number) => ({ ...p, position: idx + 1 }));

  // Fetch game results
  const { data: gamesData } = await supabase
    .from('games')
    .select(`
      id,
      name,
      type,
      game_players (
        player_id,
        position,
        score,
        payout,
        profiles ( id, display_name )
      )
    `)
    .eq('round_id', roundId);

  const gameResults = (gamesData ?? []).map((g: any) => ({
    gameId: g.id,
    gameName: g.name,
    gameType: g.type,
    standings: (g.game_players ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((gp: any) => ({
        playerId: gp.profiles?.id ?? gp.player_id,
        displayName: gp.profiles?.display_name ?? 'Unknown',
        position: gp.position,
        score: gp.score,
        payout: gp.payout ?? 0,
      })),
  }));

  // Calculate settlements
  const netPayouts: Record<string, { name: string; amount: number }> = {};
  gameResults.forEach((game: any) => {
    game.standings.forEach((s: any) => {
      if (!netPayouts[s.playerId]) {
        netPayouts[s.playerId] = { name: s.displayName, amount: 0 };
      }
      netPayouts[s.playerId].amount += s.payout;
    });
  });

  const owes = Object.entries(netPayouts)
    .filter(([_, v]) => v.amount < 0)
    .map(([id, v]) => ({ id, name: v.name, amount: Math.abs(v.amount) }))
    .sort((a, b) => b.amount - a.amount);

  const wins = Object.entries(netPayouts)
    .filter(([_, v]) => v.amount > 0)
    .map(([id, v]) => ({ id, name: v.name, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: { fromPlayerId: string; fromName: string; toPlayerId: string; toName: string; amount: number }[] = [];
  let oweIdx = 0;
  let winIdx = 0;
  const oweRemaining = owes.map((o) => ({ ...o }));
  const winRemaining = wins.map((w) => ({ ...w }));

  while (oweIdx < oweRemaining.length && winIdx < winRemaining.length) {
    const transfer = Math.min(
      oweRemaining[oweIdx].amount,
      winRemaining[winIdx].amount
    );
    if (transfer > 0) {
      settlements.push({
        fromPlayerId: oweRemaining[oweIdx].id,
        fromName: oweRemaining[oweIdx].name,
        toPlayerId: winRemaining[winIdx].id,
        toName: winRemaining[winIdx].name,
        amount: transfer,
      });
    }
    oweRemaining[oweIdx].amount -= transfer;
    winRemaining[winIdx].amount -= transfer;
    if (oweRemaining[oweIdx].amount <= 0) oweIdx++;
    if (winRemaining[winIdx].amount <= 0) winIdx++;
  }

  return (
    <ResultsView
      results={{
        roundId,
        courseName: (roundData.courses as any)?.name ?? 'Unknown Course',
        date: roundData.round_date,
        status: roundData.status,
        players: playerResults,
        games: gameResults,
        settlements,
      }}
    />
  );
}
