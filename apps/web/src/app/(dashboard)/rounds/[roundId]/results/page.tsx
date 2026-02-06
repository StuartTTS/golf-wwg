'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/supabase-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PlayerResult {
  playerId: string;
  displayName: string;
  handicap: number | null;
  grossTotal: number;
  netTotal: number;
  frontNine: number;
  backNine: number;
  toPar: number;
  position: number;
}

interface GameResult {
  gameId: string;
  gameName: string;
  gameType: string;
  standings: {
    playerId: string;
    displayName: string;
    position: number;
    score: string;
    payout: number;
  }[];
}

interface Settlement {
  fromPlayerId: string;
  fromName: string;
  toPlayerId: string;
  toName: string;
  amount: number;
}

interface RoundResults {
  roundId: string;
  courseName: string;
  date: string;
  status: string;
  players: PlayerResult[];
  games: GameResult[];
  settlements: Settlement[];
}

export default function ResultsPage() {
  const params = useParams<{ roundId: string }>();
  const router = useRouter();
  const { supabase } = useSupabase();
  const roundId = params.roundId;

  const [results, setResults] = useState<RoundResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      if (!supabase || !roundId) return;

      try {
        setLoading(true);

        // Fetch round with scores
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

        if (roundError) throw roundError;

        // Fetch all scores for this round
        const { data: scoresData, error: scoresError } = await supabase
          .from('scores')
          .select('player_id, hole_number, strokes')
          .eq('round_id', roundId);

        if (scoresError) throw scoresError;

        // Fetch holes info
        const teeBoxId = roundData.round_players[0]?.tee_box_id;
        const { data: holesData } = await supabase
          .from('holes')
          .select('hole_number, par')
          .eq('tee_box_id', teeBoxId)
          .order('hole_number');

        const holes = holesData ?? [];
        const totalPar = holes.reduce((sum: number, h: any) => sum + h.par, 0);
        const frontPar = holes
          .filter((h: any) => h.hole_number <= 9)
          .reduce((sum: number, h: any) => sum + h.par, 0);
        const backPar = holes
          .filter((h: any) => h.hole_number > 9)
          .reduce((sum: number, h: any) => sum + h.par, 0);

        // Build player results
        const playerResults: PlayerResult[] = roundData.round_players
          .map((rp: any) => {
            const playerScores = (scoresData ?? []).filter(
              (s: any) => s.player_id === rp.profiles.id
            );
            const frontScores = playerScores.filter(
              (s: any) => s.hole_number <= 9
            );
            const backScores = playerScores.filter(
              (s: any) => s.hole_number > 9
            );
            const grossTotal = playerScores.reduce(
              (sum: number, s: any) => sum + (s.strokes ?? 0),
              0
            );
            const frontNine = frontScores.reduce(
              (sum: number, s: any) => sum + (s.strokes ?? 0),
              0
            );
            const backNine = backScores.reduce(
              (sum: number, s: any) => sum + (s.strokes ?? 0),
              0
            );
            const handicap = rp.profiles.handicap ?? 0;
            const netTotal = grossTotal - handicap;

            return {
              playerId: rp.profiles.id,
              displayName: rp.profiles.display_name,
              handicap: rp.profiles.handicap,
              grossTotal,
              netTotal,
              frontNine,
              backNine,
              toPar: grossTotal - totalPar,
              position: 0,
            };
          })
          .sort((a: PlayerResult, b: PlayerResult) => a.grossTotal - b.grossTotal)
          .map((p: PlayerResult, idx: number) => ({ ...p, position: idx + 1 }));

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

        const gameResults: GameResult[] = (gamesData ?? []).map((g: any) => ({
          gameId: g.id,
          gameName: g.name,
          gameType: g.type,
          standings: (g.game_players ?? [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((gp: any) => ({
              playerId: gp.profiles.id,
              displayName: gp.profiles.display_name,
              position: gp.position,
              score: gp.score,
              payout: gp.payout ?? 0,
            })),
        }));

        // Calculate settlements (net payouts between players)
        const netPayouts: Record<string, { name: string; amount: number }> = {};
        gameResults.forEach((game) => {
          game.standings.forEach((s) => {
            if (!netPayouts[s.playerId]) {
              netPayouts[s.playerId] = { name: s.displayName, amount: 0 };
            }
            netPayouts[s.playerId].amount += s.payout;
          });
        });

        // Simplify settlements: those who owe pay those who won
        const owes = Object.entries(netPayouts)
          .filter(([_, v]) => v.amount < 0)
          .map(([id, v]) => ({ id, name: v.name, amount: Math.abs(v.amount) }))
          .sort((a, b) => b.amount - a.amount);

        const wins = Object.entries(netPayouts)
          .filter(([_, v]) => v.amount > 0)
          .map(([id, v]) => ({ id, name: v.name, amount: v.amount }))
          .sort((a, b) => b.amount - a.amount);

        const settlements: Settlement[] = [];
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

        setResults({
          roundId,
          courseName: roundData.courses?.name ?? 'Unknown Course',
          date: roundData.round_date,
          status: roundData.status,
          players: playerResults,
          games: gameResults,
          settlements,
        });
      } catch (err) {
        console.error('Failed to load results:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [supabase, roundId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-dark-600">Results not available</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-900">Round Results</h1>
        <p className="text-sm text-dark-600">
          {results.courseName} &middot;{' '}
          {new Date(results.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Final Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Final Scores</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-xs font-semibold text-dark-600 uppercase tracking-wide pb-2 border-b border-dark-300">
            <span>Player</span>
            <span className="w-12 text-center">OUT</span>
            <span className="w-12 text-center">IN</span>
            <span className="w-14 text-center">Gross</span>
            <span className="w-14 text-center">Net</span>
          </div>

          <div className="divide-y divide-gray-100">
            {results.players.map((player) => (
              <div
                key={player.playerId}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${
                        player.position === 1
                          ? 'bg-yellow-900/40 text-yellow-400'
                          : 'bg-gray-100 text-dark-600'
                      }
                    `}
                  >
                    {player.position}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-dark-900">
                      {player.displayName}
                    </p>
                    {player.handicap !== null && (
                      <p className="text-xs text-dark-500">
                        HCP {player.handicap}
                      </p>
                    )}
                  </div>
                </div>
                <span className="w-12 text-center text-sm tabular-nums text-dark-800">
                  {player.frontNine || '-'}
                </span>
                <span className="w-12 text-center text-sm tabular-nums text-dark-800">
                  {player.backNine || '-'}
                </span>
                <span className="w-14 text-center text-sm font-bold tabular-nums text-dark-900">
                  {player.grossTotal || '-'}
                </span>
                <span className="w-14 text-center text-sm tabular-nums text-dark-700">
                  {player.netTotal || '-'}
                </span>
              </div>
            ))}
          </div>

          {/* To par display */}
          <div className="mt-3 pt-3 border-t border-dark-300">
            <div className="flex flex-wrap gap-3">
              {results.players.map((player) => (
                <div key={player.playerId} className="flex items-center gap-1">
                  <span className="text-xs text-dark-600">
                    {player.displayName}:
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      player.toPar < 0
                        ? 'text-red-400'
                        : player.toPar > 0
                        ? 'text-blue-600'
                        : 'text-dark-700'
                    }`}
                  >
                    {player.toPar === 0
                      ? 'E'
                      : player.toPar > 0
                      ? `+${player.toPar}`
                      : player.toPar}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Game Results */}
      {results.games.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Game Results</CardTitle>
            <CardDescription>
              {results.games.length} game{results.games.length !== 1 ? 's' : ''}{' '}
              played
            </CardDescription>
          </CardHeader>
          <div className="px-4 pb-4 space-y-4">
            {results.games.map((game) => (
              <div key={game.gameId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-dark-900">
                    {game.gameName}
                  </h4>
                  <Badge variant="secondary" className="text-xs">
                    {game.gameType}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {game.standings.map((s) => (
                    <div
                      key={s.playerId}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-dark-500 text-xs w-4">
                          {s.position}.
                        </span>
                        <span className="text-dark-800">{s.displayName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-dark-700">{s.score}</span>
                        {s.payout !== 0 && (
                          <span
                            className={`text-xs font-bold ${
                              s.payout > 0 ? 'text-golf-600' : 'text-red-400'
                            }`}
                          >
                            {s.payout > 0 ? '+' : ''}${s.payout}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Settlement Summary */}
      {results.settlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Settlement</CardTitle>
            <CardDescription>
              Who owes whom - simplified payments
            </CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="space-y-3">
              {results.settlements.map((settlement, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-dark-50 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-red-400">
                      {settlement.fromName}
                    </span>
                    <svg
                      className="w-4 h-4 text-dark-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                    <span className="font-medium text-golf-600">
                      {settlement.toName}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-dark-900">
                    ${settlement.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/rounds/${roundId}/scorecard`)}
        >
          View Scorecard
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/rounds/${roundId}/games`)}
        >
          View Games
        </Button>
      </div>
    </div>
  );
}
