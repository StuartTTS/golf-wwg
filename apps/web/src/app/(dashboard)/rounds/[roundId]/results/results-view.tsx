'use client';

import { useRouter } from 'next/navigation';
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

interface ResultsViewProps {
  results: RoundResults;
}

export default function ResultsView({ results }: ResultsViewProps) {
  const router = useRouter();
  const roundId = results.roundId;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Round Results</h1>
        <p className="text-sm text-surface-300">
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
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-xs font-semibold text-surface-300 uppercase tracking-wide pb-2 border-b border-surface-500">
            <span>Player</span>
            <span className="w-12 text-center">OUT</span>
            <span className="w-12 text-center">IN</span>
            <span className="w-14 text-center">Gross</span>
            <span className="w-14 text-center">Net</span>
          </div>

          <div className="divide-y divide-surface-600">
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
                          ? 'bg-gold-500/20 text-gold-500'
                          : 'bg-surface-700 text-surface-300'
                      }
                    `}
                  >
                    {player.position}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-surface-50">
                      {player.displayName}
                    </p>
                    {player.handicap !== null && (
                      <p className="text-xs text-surface-400">
                        HCP {player.handicap}
                      </p>
                    )}
                  </div>
                </div>
                <span className="w-12 text-center text-sm tabular-nums text-surface-100">
                  {player.frontNine || '-'}
                </span>
                <span className="w-12 text-center text-sm tabular-nums text-surface-100">
                  {player.backNine || '-'}
                </span>
                <span className="w-14 text-center text-sm font-bold tabular-nums text-surface-50">
                  {player.grossTotal || '-'}
                </span>
                <span className="w-14 text-center text-sm tabular-nums text-surface-200">
                  {player.netTotal || '-'}
                </span>
              </div>
            ))}
          </div>

          {/* To par display */}
          <div className="mt-3 pt-3 border-t border-surface-500">
            <div className="flex flex-wrap gap-3">
              {results.players.map((player) => (
                <div key={player.playerId} className="flex items-center gap-1">
                  <span className="text-xs text-surface-300">
                    {player.displayName}:
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      player.toPar < 0
                        ? 'text-red-400'
                        : player.toPar > 0
                        ? 'text-blue-600'
                        : 'text-surface-200'
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
                  <h4 className="text-sm font-semibold text-surface-50">
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
                        <span className="text-surface-400 text-xs w-4">
                          {s.position}.
                        </span>
                        <span className="text-surface-100">{s.displayName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-surface-200">{s.score}</span>
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
                  className="flex items-center justify-between p-3 bg-surface-700 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-red-400">
                      {settlement.fromName}
                    </span>
                    <svg
                      className="w-4 h-4 text-surface-400"
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
                  <span className="text-sm font-bold text-surface-50">
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
