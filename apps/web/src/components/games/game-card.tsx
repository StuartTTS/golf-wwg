'use client';

import Link from 'next/link';
import type { GameResult } from '@golf/core';
import { Badge } from '@/components/ui';

interface GameCardProps {
  game: {
    id: string;
    roundId: string;
    format: string;
    name: string | null;
    status: string;
    moneyPerUnit: number | null;
    holes: string;
  };
  result: GameResult | null;
  formatName: string;
}

export function GameCard({ game, result, formatName }: GameCardProps) {
  const statusVariant = {
    pending: 'default' as const,
    active: 'info' as const,
    finalized: 'success' as const,
  }[game.status] ?? 'default' as const;

  return (
    <Link
      href={`/rounds/${game.roundId}/games/${game.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-golf-300 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-900">
          {game.name || formatName}
        </h3>
        <Badge variant={statusVariant}>{game.status}</Badge>
      </div>

      {game.moneyPerUnit && (
        <p className="text-sm text-slate-500 mb-2">
          ${game.moneyPerUnit} per unit • {game.holes === 'all' ? '18 holes' : game.holes}
        </p>
      )}

      {result && result.playerStandings.length > 0 && (
        <div className="mt-2 space-y-1">
          {result.playerStandings.slice(0, 3).map((standing, i) => (
            <div key={standing.playerId} className="flex items-center justify-between text-sm">
              <span className={i === 0 ? 'font-medium text-slate-900' : 'text-slate-600'}>
                {standing.position}. {standing.playerId}
              </span>
              {standing.moneyWon > 0 && (
                <span className="text-green-600 font-medium">
                  +${standing.moneyWon.toFixed(2)}
                </span>
              )}
            </div>
          ))}
          {result.playerStandings.length > 3 && (
            <p className="text-xs text-slate-400">
              +{result.playerStandings.length - 3} more players
            </p>
          )}
        </div>
      )}
    </Link>
  );
}
