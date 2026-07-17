'use client';

import { useMemo, useState } from 'react';
import {
  type PlayRound,
  type PlayScore,
  type PlayHole,
  computeStanding,
  formatToPar,
} from './shared';

interface LeaderboardViewProps {
  round: PlayRound;
  scores: PlayScore[];
}

/**
 * Whole-round leaderboard across ALL tee-time groups (flights).
 * Toggles between gross and net; ranks by the selected basis.
 */
export function LeaderboardView({ round, scores }: LeaderboardViewProps) {
  const [basis, setBasis] = useState<'gross' | 'net'>(round.scoring);

  const holesFor = (teeBoxId: string): PlayHole[] =>
    round.holesByTeeBox[teeBoxId] ??
    round.defaultHoles ??
    [];

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of round.teeGroups) m.set(g.id, g.name);
    return m;
  }, [round.teeGroups]);

  const standings = useMemo(() => {
    return round.players
      .map((p) => ({
        standing: computeStanding(p, scores, holesFor(p.teeBoxId)),
        groupName: p.teeTimeGroupId
          ? groupNameById.get(p.teeTimeGroupId) ?? null
          : null,
      }))
      .sort((a, b) => {
        // Players who have started rank above those who haven't.
        const aStarted = a.standing.holesPlayed > 0 ? 0 : 1;
        const bStarted = b.standing.holesPlayed > 0 ? 0 : 1;
        if (aStarted !== bStarted) return aStarted - bStarted;
        const key = basis === 'net' ? 'netToPar' : 'grossToPar';
        return a.standing[key] - b.standing[key];
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.players, scores, basis, groupNameById]);

  const anyStarted = standings.some((s) => s.standing.holesPlayed > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-surface-50">Leaderboard</h2>
        <div className="inline-flex rounded-lg bg-surface-700 p-0.5 text-sm">
          {(['net', 'gross'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBasis(b)}
              className={`px-3 py-1 rounded-md capitalize transition-colors ${
                basis === b
                  ? 'bg-golf-600 text-white font-medium'
                  : 'text-surface-300 hover:text-surface-100'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {!anyStarted ? (
        <div className="rounded-xl bg-surface-800 border border-surface-600 p-8 text-center text-surface-300">
          No scores yet. The leaderboard updates live as scores come in.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Column header */}
          <div className="flex items-center px-3 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
            <span className="w-7">#</span>
            <span className="flex-1">Player</span>
            <span className="w-12 text-center">Thru</span>
            <span className="w-14 text-right capitalize">{basis}</span>
          </div>

          {standings.map(({ standing, groupName }, index) => {
            const toPar =
              basis === 'net' ? standing.netToPar : standing.grossToPar;
            const started = standing.holesPlayed > 0;
            const rank = started ? index + 1 : null;
            const isCurrentUser = standing.player.id === round.currentUserId;

            return (
              <div
                key={standing.player.id}
                className={`flex items-center p-3 rounded-lg border ${
                  isCurrentUser
                    ? 'bg-golf-900/30 border-golf-500/50'
                    : index === 0 && started
                      ? 'bg-gold-500/10 border-gold-500/30'
                      : 'bg-surface-800 border-surface-600'
                }`}
              >
                <span className="w-7 text-sm font-bold text-surface-200">
                  {rank ?? '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-50 truncate">
                    {standing.player.displayName}
                    {standing.player.isGuest && (
                      <span className="ml-1.5 text-[10px] text-surface-400">
                        (G)
                      </span>
                    )}
                  </p>
                  {groupName && (
                    <p className="text-[11px] text-surface-400 truncate">
                      {groupName}
                    </p>
                  )}
                </div>
                <span className="w-12 text-center text-xs text-surface-300">
                  {standing.thruLabel}
                </span>
                <span
                  className={`w-14 text-right text-sm font-bold tabular-nums ${
                    !started
                      ? 'text-surface-500'
                      : toPar < 0
                        ? 'text-red-400'
                        : toPar > 0
                          ? 'text-blue-400'
                          : 'text-surface-100'
                  }`}
                >
                  {started ? formatToPar(toPar) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="px-1 text-[11px] text-surface-500">
        {basis === 'net'
          ? 'Net = gross minus handicap strokes received on holes played.'
          : 'Gross = total strokes on holes played.'}
      </p>
    </div>
  );
}
