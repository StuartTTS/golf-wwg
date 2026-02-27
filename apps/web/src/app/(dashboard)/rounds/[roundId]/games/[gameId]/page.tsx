'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/supabase-provider';
import { useGameResults } from '@golf/ui';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GameDetail {
  id: string;
  type: string;
  name: string;
  status: 'active' | 'completed' | 'pending';
  buyIn: number;
  roundId: string;
  createdAt: string;
}

interface Standing {
  playerId: string;
  displayName: string;
  position: number;
  score: string;
  payout: number;
  details: Record<string, any>;
}

interface HoleResult {
  holeNumber: number;
  winnerId: string | null;
  winnerName: string | null;
  value: number;
  carried: boolean;
}

export default function GameDetailPage() {
  const params = useParams<{ roundId: string; gameId: string }>();
  const router = useRouter();
  const { supabase } = useSupabase();
  const { roundId, gameId } = params;

  const [game, setGame] = useState<GameDetail | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  const gameResults = useGameResults({
    gameId,
    formatId: '',
    scoreData: [],
    config: {},
  } as any);

  useEffect(() => {
    async function fetchGame() {
      if (!supabase || !gameId) return;

      try {
        setLoading(true);

        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select(`
            id,
            format,
            name,
            status,
            money_per_unit,
            round_id,
            created_at,
            game_players (
              player_id,
              team_id,
              playing_handicap,
              profiles:profiles!game_players_player_id_fkey (
                id,
                display_name
              )
            )
          `)
          .eq('id', gameId)
          .single();

        if (gameError) throw gameError;

        setGame({
          id: gameData.id,
          type: gameData.format,
          name: gameData.name ?? '',
          status: gameData.status as GameDetail['status'],
          buyIn: gameData.money_per_unit ?? 0,
          roundId: gameData.round_id,
          createdAt: gameData.created_at,
        });

        setStandings(
          (gameData.game_players ?? [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((gp: any) => ({
              playerId: gp.profiles.id,
              displayName: gp.profiles.display_name,
              position: gp.position,
              score: gp.score,
              payout: gp.payout ?? 0,
              details: gp.details ?? {},
            }))
        );
      } catch (err) {
        console.error('Failed to load game:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchGame();
  }, [supabase, gameId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-golf-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-surface-300">Game not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          Go Back
        </Button>
      </div>
    );
  }

  const totalPot = game.buyIn * standings.length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push(`/rounds/${roundId}/games`)}
            className="text-sm text-surface-300 hover:text-surface-100 mb-1 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Games
          </button>
          <h1 className="text-2xl font-bold text-surface-50">{game.name}</h1>
        </div>
        <Badge variant={game.status === 'active' ? 'default' : 'secondary'}>
          {game.status === 'active' ? 'Live' : game.status}
        </Badge>
      </div>

      {/* Game Info */}
      <Card>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-surface-300 uppercase tracking-wide">Type</p>
              <p className="text-sm font-semibold text-surface-50 mt-1">{game.name}</p>
            </div>
            <div>
              <p className="text-xs text-surface-300 uppercase tracking-wide">Buy-in</p>
              <p className="text-sm font-semibold text-surface-50 mt-1">
                {game.buyIn > 0 ? `$${game.buyIn}` : 'Free'}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-300 uppercase tracking-wide">Pot</p>
              <p className="text-sm font-semibold text-golf-600 mt-1">
                {totalPot > 0 ? `$${totalPot}` : '-'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Standings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Standings</CardTitle>
          <CardDescription>
            {game.status === 'active'
              ? 'Live standings - scores update in real time'
              : 'Final results'}
          </CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="space-y-1">
            {standings.map((standing, idx) => (
              <div
                key={standing.playerId}
                className={`
                  flex items-center justify-between p-3 rounded-lg
                  ${idx === 0 && game.status === 'completed' ? 'bg-gold-500/20 border border-gold-400' : 'hover:bg-surface-700'}
                `}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${
                        standing.position === 1
                          ? 'bg-gold-500/20 text-gold-500'
                          : standing.position === 2
                          ? 'bg-surface-600 text-surface-200'
                          : standing.position === 3
                          ? 'bg-amber-700/20 text-amber-700'
                          : 'bg-surface-700 text-surface-300'
                      }
                    `}
                  >
                    {standing.position}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-surface-50">
                      {standing.displayName}
                    </p>
                    <p className="text-xs text-surface-300">{standing.score}</p>
                  </div>
                </div>
                <div className="text-right">
                  {standing.payout !== 0 && (
                    <p
                      className={`text-sm font-bold ${
                        standing.payout > 0 ? 'text-golf-600' : 'text-red-400'
                      }`}
                    >
                      {standing.payout > 0 ? '+' : ''}${Math.abs(standing.payout)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Game-specific details */}
      {game.type === 'skins' && (gameResults as any).holeResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skins</CardTitle>
            <CardDescription>Hole-by-hole skin results</CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 gap-1">
              {((gameResults as any).holeResults as HoleResult[]).map((hr) => (
                <div
                  key={hr.holeNumber}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-surface-300 w-8">
                      #{hr.holeNumber}
                    </span>
                    <span className="text-sm text-surface-50">
                      {hr.winnerName ?? (hr.carried ? 'Carried over' : 'Push')}
                    </span>
                  </div>
                  {hr.value > 0 && (
                    <span className="text-xs font-semibold text-golf-600">
                      ${hr.value}
                    </span>
                  )}
                  {hr.carried && (
                    <Badge variant="secondary" className="text-xs">
                      Carry
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {game.type === 'nassau' && (gameResults as any).nassauDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nassau Breakdown</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4 space-y-4">
            {['front', 'back', 'overall'].map((segment) => {
              const segmentData = ((gameResults as any).nassauDetails as any)?.[segment];
              if (!segmentData) return null;

              return (
                <div key={segment}>
                  <h4 className="text-xs font-semibold text-surface-300 uppercase tracking-wide mb-2">
                    {segment === 'front'
                      ? 'Front 9'
                      : segment === 'back'
                      ? 'Back 9'
                      : 'Overall'}
                  </h4>
                  <div className="space-y-1">
                    {(segmentData.standings ?? []).map((s: any, i: number) => (
                      <div
                        key={s.playerId}
                        className="flex justify-between text-sm py-1"
                      >
                        <span className="text-surface-100">{s.displayName}</span>
                        <span className="font-medium">{s.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Payouts summary */}
      {game.status === 'completed' && standings.some((s) => s.payout !== 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payouts</CardTitle>
            <CardDescription>Settlement summary</CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {standings
                .filter((s) => s.payout !== 0)
                .sort((a, b) => b.payout - a.payout)
                .map((s) => (
                  <div
                    key={s.playerId}
                    className="flex items-center justify-between py-2 border-b border-surface-600 last:border-0"
                  >
                    <span className="text-sm text-surface-100">
                      {s.displayName}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        s.payout > 0 ? 'text-golf-600' : 'text-red-400'
                      }`}
                    >
                      {s.payout > 0 ? 'Wins' : 'Owes'} ${Math.abs(s.payout)}
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
          Scorecard
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/rounds/${roundId}/games`)}
        >
          All Games
        </Button>
      </div>
    </div>
  );
}
