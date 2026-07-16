'use client';

import { useMemo } from 'react';
import {
  type PlayRound,
  type PlayScore,
  type PlayHole,
  type PlayPlayer,
  computeStanding,
  formatToPar,
  scoreToParClasses,
} from './shared';

interface GroupScorecardViewProps {
  round: PlayRound;
  scores: PlayScore[];
}

/**
 * Read-optimized 18-hole card for the current user's tee-time group.
 * Falls back to the whole field if the round has no flights.
 */
export function GroupScorecardView({ round, scores }: GroupScorecardViewProps) {
  const hasFlights = round.players.some((p) => p.teeTimeGroupId !== null);

  const flightPlayers = useMemo<PlayPlayer[]>(() => {
    if (!hasFlights || !round.currentUserGroupId) return round.players;
    return round.players.filter(
      (p) => p.teeTimeGroupId === round.currentUserGroupId
    );
  }, [hasFlights, round.currentUserGroupId, round.players]);

  const holesFor = (teeBoxId: string): PlayHole[] =>
    round.holesByTeeBox[teeBoxId] ?? round.defaultHoles ?? [];

  // Use the current user's holes (or the first flight player's) for the grid layout.
  const layoutHoles =
    holesFor(flightPlayers[0]?.teeBoxId ?? '') ?? round.defaultHoles;
  const front = layoutHoles.filter((h) => h.number <= 9);
  const back = layoutHoles.filter((h) => h.number > 9);

  const scoreFor = (playerId: string, holeNumber: number) =>
    scores.find((s) => s.playerId === playerId && s.holeNumber === holeNumber)
      ?.strokes ?? null;

  const groupName = round.currentUserGroupId
    ? round.teeGroups.find((g) => g.id === round.currentUserGroupId)?.name
    : null;

  const renderNine = (nine: PlayHole[], label: string) => {
    if (nine.length === 0) return null;
    const parSum = nine.reduce((s, h) => s + h.par, 0);
    return (
      <div className="overflow-x-auto">
        <table className="border-collapse w-full text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface-800 text-left px-2 py-1.5 text-[11px] font-semibold text-surface-300">
                HOLE
              </th>
              {nine.map((h) => (
                <th
                  key={h.number}
                  className="w-8 text-center text-[11px] font-semibold text-surface-300"
                >
                  {h.number}
                </th>
              ))}
              <th className="w-10 text-center text-[11px] font-bold text-surface-100">
                {label}
              </th>
            </tr>
            <tr>
              <td className="sticky left-0 z-10 bg-surface-700 px-2 py-1 text-[11px] font-semibold text-surface-300">
                PAR
              </td>
              {nine.map((h) => (
                <td
                  key={h.number}
                  className="w-8 text-center text-[11px] text-surface-200 bg-surface-700"
                >
                  {h.par}
                </td>
              ))}
              <td className="w-10 text-center text-[11px] font-bold text-surface-100 bg-surface-700">
                {parSum}
              </td>
            </tr>
          </thead>
          <tbody>
            {flightPlayers.map((player) => {
              const holesForPlayer = holesFor(player.teeBoxId);
              const parByNum = new Map(
                holesForPlayer.map((h) => [h.number, h.par])
              );
              let sum = 0;
              let any = false;
              return (
                <tr key={player.id} className="border-t border-surface-700">
                  <td className="sticky left-0 z-10 bg-surface-800 px-2 py-1.5 text-xs font-medium text-surface-50 truncate max-w-[90px]">
                    {player.displayName}
                  </td>
                  {nine.map((h) => {
                    const strokes = scoreFor(player.id, h.number);
                    const par = parByNum.get(h.number) ?? h.par;
                    if (strokes !== null) {
                      sum += strokes;
                      any = true;
                    }
                    return (
                      <td key={h.number} className="w-8 h-9 p-0 text-center">
                        <div
                          className={`w-full h-9 flex items-center justify-center text-sm ${scoreToParClasses(
                            strokes,
                            par
                          )}`}
                        >
                          {strokes ?? '·'}
                        </div>
                      </td>
                    );
                  })}
                  <td className="w-10 text-center text-sm font-bold text-surface-50 bg-surface-700/50">
                    {any ? sum : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-surface-50">
          {groupName ?? 'Group'} Scorecard
        </h2>
        <span className="text-xs text-surface-400">
          {flightPlayers.length} player{flightPlayers.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="rounded-xl bg-surface-800 border border-surface-600 p-3 space-y-4">
        {renderNine(front, 'OUT')}
        {renderNine(back, 'IN')}
      </div>

      {/* Totals summary (gross + net) */}
      <div className="rounded-xl bg-surface-800 border border-surface-600 p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 mb-2">
          Totals
        </h3>
        <div className="space-y-2">
          {flightPlayers.map((player) => {
            const standing = computeStanding(
              player,
              scores,
              holesFor(player.teeBoxId)
            );
            return (
              <div
                key={player.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium text-surface-100 truncate">
                  {player.displayName}
                </span>
                <div className="flex items-center gap-4 tabular-nums">
                  <span className="text-xs text-surface-400 w-14 text-right">
                    thru {standing.thruLabel}
                  </span>
                  <span className="font-bold text-surface-50 w-8 text-right">
                    {standing.holesPlayed > 0 ? standing.grossStrokes : '—'}
                  </span>
                  <span className="text-surface-300 w-10 text-right text-xs">
                    {standing.holesPlayed > 0
                      ? `gross ${formatToPar(standing.grossToPar)}`
                      : ''}
                  </span>
                  <span className="text-golf-400 w-10 text-right text-xs">
                    {standing.holesPlayed > 0
                      ? `net ${formatToPar(standing.netToPar)}`
                      : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
