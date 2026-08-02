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
        id,
        user_id,
        tee_box_id,
        guest_name,
        guest_handicap_index,
        handicap_index_at_round,
        course_handicap,
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
    .select('player_id, round_player_id, hole_number, strokes')
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

  // Build player results. Guests have no linked profile — fall back to their
  // guest_name/handicap, and key scores by round_player_id (present on every row).
  // Players with NO scores must not show a bogus "net" (= −handicap) or rank as
  // if leading — they sink to the bottom with blank net/to-par.
  const playerResults = roundData.round_players
    .map((rp: any) => {
      const prof = rp.profiles;
      const playerScores = (scoresData ?? []).filter(
        (s) => s.round_player_id === rp.id && s.strokes != null
      );
      const holesPlayed = playerScores.length;
      const frontScores = playerScores.filter((s) => s.hole_number <= 9);
      const backScores = playerScores.filter((s) => s.hole_number > 9);
      const grossTotal = playerScores.reduce((sum, s) => sum + (s.strokes ?? 0), 0);
      const frontNine = frontScores.reduce((sum, s) => sum + (s.strokes ?? 0), 0);
      const backNine = backScores.reduce((sum, s) => sum + (s.strokes ?? 0), 0);
      // Displayed HCP is the index used FOR THIS ROUND (so it matches the net);
      // NET uses their COURSE handicap (index × slope ÷ 113) — the same number
      // the games use — so net is consistent everywhere.
      const handicap =
        rp.handicap_index_at_round ??
        prof?.current_handicap_index ??
        rp.guest_handicap_index ??
        null;
      const courseHandicap = rp.course_handicap ?? null;

      return {
        playerId: prof?.id ?? rp.id,
        displayName: prof?.display_name ?? rp.guest_name ?? 'Guest',
        handicap,
        holesPlayed,
        grossTotal,
        // Blank net / to-par until they've actually posted scores.
        netTotal: holesPlayed > 0 ? grossTotal - (courseHandicap ?? 0) : null,
        frontNine,
        backNine,
        toPar: holesPlayed > 0 ? grossTotal - totalPar : null,
        position: 0,
      };
    })
    .sort((a: any, b: any) => {
      // Players who've started rank above those who haven't.
      const aStarted = a.holesPlayed > 0 ? 0 : 1;
      const bStarted = b.holesPlayed > 0 ? 0 : 1;
      if (aStarted !== bStarted) return aStarted - bStarted;
      if (aStarted === 0) return (a.netTotal ?? 0) - (b.netTotal ?? 0); // by net
      return a.displayName.localeCompare(b.displayName); // not started: by name
    })
    .map((p: any, idx: number) => ({ ...p, position: idx + 1 }));

  // Game standings + payouts aren't persisted yet (per-game results are Phase 5),
  // so list the games without standings for now — the gross/net leaderboard above
  // is the live result. Selecting only real columns keeps this from erroring.
  const { data: gamesData } = await supabase
    .from('games')
    .select('id, name, format')
    .eq('round_id', roundId);

  const gameResults = (gamesData ?? []).map((g: any) => ({
    gameId: g.id,
    gameName: g.name,
    gameType: g.format,
    standings: [] as {
      playerId: string;
      displayName: string;
      position: number;
      score: string;
      payout: number;
    }[],
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
