'use client';

// Full paper-style scorecard: one row per player, holes 1-18 across the top with
// hole number + par header rows, OUT / IN / TOT columns, color-coded scores. One
// continuous table that scrolls horizontally on a phone — what you'd see on a
// paper card. Tap a cell you're allowed to score to edit it (scoring RLS is
// mirrored by canScoreForPlayer); entry is otherwise done on the Play screen.

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeScores } from '@/hooks/use-realtime-scores';
import { upsertScore } from '@/lib/actions/scores';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HoleInfo {
  number: number;
  par: number;
  strokeIndex: number;
  yardage: number;
}

interface Player {
  id: string;
  displayName: string;
  handicap: number | null;
  playingHandicap: number;
  teeBoxId: string;
  teeTimeGroupId: string | null;
  isGuest?: boolean;
}

interface Score {
  playerId: string;
  holeNumber: number;
  strokes: number | null;
  putts: number | null;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
}

interface RoundData {
  id: string;
  courseId: string;
  courseName: string;
  status: 'pending' | 'in_progress' | 'completed';
  date: string;
  players: Player[];
  holes: HoleInfo[]; // default tee box holes (drives the HOLE / PAR header)
  holesByTeeBox: Record<string, HoleInfo[]>;
  currentUserGroupId: string | null;
}

/**
 * PGA-style shape around a score: a red circle for a birdie (double for eagle+),
 * a blue box for a bogey (double for double-bogey+), nothing for par. Applied to
 * a fixed-size span that wraps the number. See the legend under the card.
 */
function scoreShape(strokes: number | null, par: number): string {
  if (strokes === null) return '';
  const diff = strokes - par;
  if (diff <= -2)
    return 'rounded-full border-2 border-red-400 outline outline-1 outline-offset-[3px] outline-red-400 text-red-300 font-bold'; // eagle: double circle
  if (diff === -1) return 'rounded-full border-2 border-red-400 text-red-300 font-semibold'; // birdie: circle
  if (diff === 0) return 'text-surface-50'; // par
  if (diff === 1) return 'border-2 border-blue-400 text-blue-300'; // bogey: box
  return 'border-2 border-blue-400 outline outline-1 outline-offset-[3px] outline-blue-400 text-blue-300'; // double+: double box
}

function ScoreInput({
  par,
  currentScore,
  playerName,
  holeNumber,
  onSubmit,
  onCancel,
}: {
  par: number;
  currentScore: number | null;
  playerName: string;
  holeNumber: number;
  onSubmit: (score: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<number>(currentScore ?? par);
  const quickScores = useMemo(
    () => [par - 2, par - 1, par, par + 1, par + 2, par + 3].filter((n) => n >= 1),
    [par]
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface-800 w-full max-w-sm rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-300">
              Hole {holeNumber} &middot; Par {par}
            </p>
            <p className="text-lg font-semibold text-surface-50">{playerName}</p>
          </div>
          <button onClick={onCancel} className="text-surface-400 hover:text-surface-200 p-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setValue((v) => Math.max(1, v - 1))}
            className="w-14 h-14 rounded-full bg-surface-700 hover:bg-surface-600 flex items-center justify-center text-2xl font-bold"
          >
            −
          </button>
          <span className="text-5xl font-bold tabular-nums w-20 text-center text-surface-50">
            {value}
          </span>
          <button
            onClick={() => setValue((v) => Math.min(15, v + 1))}
            className="w-14 h-14 rounded-full bg-surface-700 hover:bg-surface-600 flex items-center justify-center text-2xl font-bold"
          >
            +
          </button>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {quickScores.map((qs) => (
            <button
              key={qs}
              onClick={() => setValue(qs)}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                value === qs
                  ? 'bg-golf-600 text-white'
                  : 'bg-surface-700 hover:bg-surface-600 text-surface-100'
              }`}
            >
              {qs}
            </button>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => onSubmit(value)}>
            Save Score
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ScorecardViewProps {
  initialRound: RoundData;
  initialScores?: Score[];
}

export default function ScorecardView({ initialRound, initialScores = [] }: ScorecardViewProps) {
  const router = useRouter();
  const roundId = initialRound.id;
  const [round] = useState<RoundData>(initialRound);
  const [scores, setScores] = useState<Score[]>(initialScores);
  const [saving, setSaving] = useState(false);
  const [activeInput, setActiveInput] = useState<{ playerId: string; holeNumber: number } | null>(
    null
  );

  // Live updates from other scorers.
  useRealtimeScores({
    roundId,
    onScoreChange: (live) => {
      setScores((prev) => {
        let next = prev;
        for (const r of live) {
          if (!r.playerId) continue;
          const idx = next.findIndex(
            (s) => s.playerId === r.playerId && s.holeNumber === r.holeNumber
          );
          const row: Score = {
            playerId: r.playerId,
            holeNumber: r.holeNumber,
            strokes: r.strokes,
            putts: null,
            fairwayHit: null,
            greenInRegulation: null,
          };
          if (idx >= 0) {
            if (next === prev) next = [...prev];
            next[idx] = { ...next[idx], strokes: r.strokes };
          } else {
            if (next === prev) next = [...prev];
            next.push(row);
          }
        }
        return next === prev ? prev : next;
      });
    },
  });

  // Mirror the scores RLS: any-group rounds let anyone score; with flights you
  // can only score your own group. Cells you can't score are view-only.
  const hasAnyGroups = round.players.some((p) => p.teeTimeGroupId !== null);
  const canScoreForPlayer = useCallback(
    (playerId: string): boolean => {
      if (round.status === 'completed') return false; // finished round = view only
      if (!hasAnyGroups || !round.currentUserGroupId) return true;
      const player = round.players.find((p) => p.id === playerId);
      return player?.teeTimeGroupId === round.currentUserGroupId;
    },
    [hasAnyGroups, round.currentUserGroupId, round.players, round.status]
  );

  const holesFor = useCallback(
    (playerId: string): HoleInfo[] => {
      const player = round.players.find((p) => p.id === playerId);
      return (
        round.holesByTeeBox[player?.teeBoxId ?? ''] ??
        Object.values(round.holesByTeeBox)[0] ??
        round.holes
      );
    },
    [round]
  );

  const parFor = useCallback(
    (playerId: string, holeNumber: number): number =>
      holesFor(playerId).find((h) => h.number === holeNumber)?.par ??
      round.holes.find((h) => h.number === holeNumber)?.par ??
      4,
    [holesFor, round.holes]
  );

  const scoreOf = useCallback(
    (playerId: string, holeNumber: number): number | null =>
      scores.find((s) => s.playerId === playerId && s.holeNumber === holeNumber)?.strokes ?? null,
    [scores]
  );

  const updateScore = useCallback(
    async (playerId: string, holeNumber: number, strokes: number) => {
      setSaving(true);
      setScores((prev) => {
        const idx = prev.findIndex(
          (s) => s.playerId === playerId && s.holeNumber === holeNumber
        );
        const updated: Score = {
          playerId,
          holeNumber,
          strokes,
          putts: null,
          fairwayHit: null,
          greenInRegulation: null,
        };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
      const res = await upsertScore({ roundId, playerId, holeNumber, strokes });
      if (res.error) {
        console.error('Failed to save score:', res.error);
      }
      setSaving(false);
    },
    [roundId]
  );

  const front = round.holes.filter((h) => h.number <= 9);
  const back = round.holes.filter((h) => h.number > 9);
  const parSum = (hs: HoleInfo[]) => hs.reduce((s, h) => s + h.par, 0);

  const sumFor = (playerId: string, holeNums: number[]) => {
    let total = 0;
    let any = false;
    for (const n of holeNums) {
      const s = scoreOf(playerId, n);
      if (s !== null) {
        total += s;
        any = true;
      }
    }
    return any ? total : null;
  };

  const frontNums = front.map((h) => h.number);
  const backNums = back.map((h) => h.number);
  const allNums = round.holes.map((h) => h.number);

  // Header + par cells for a run of holes.
  const activePlayer = activeInput
    ? round.players.find((p) => p.id === activeInput.playerId)
    : null;

  const numCol = 'w-9 min-w-9 text-center';
  const sumCol = 'w-11 min-w-11 text-center bg-surface-700';

  return (
    <div className="max-w-full mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-xl font-bold text-surface-50">{round.courseName}</h1>
          <p className="text-sm text-surface-300">
            {new Date(round.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-surface-400 animate-pulse">Saving…</span>}
          <Badge variant={round.status === 'in_progress' ? 'default' : 'secondary'}>
            {round.status === 'in_progress' ? 'Live' : round.status}
          </Badge>
        </div>
      </div>

      {/* Paper scorecard */}
      <div className="px-2 sm:px-4">
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm tabular-nums">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface-800 text-left px-3 py-2 text-[11px] font-semibold text-surface-300 border-b border-surface-600">
                    HOLE
                  </th>
                  {front.map((h) => (
                    <th key={h.number} className={`${numCol} py-2 text-[11px] font-semibold text-surface-300 border-b border-surface-600`}>
                      {h.number}
                    </th>
                  ))}
                  <th className={`${sumCol} py-2 text-[11px] font-bold text-surface-100 border-b border-surface-600`}>OUT</th>
                  {back.map((h) => (
                    <th key={h.number} className={`${numCol} py-2 text-[11px] font-semibold text-surface-300 border-b border-surface-600`}>
                      {h.number}
                    </th>
                  ))}
                  {back.length > 0 && (
                    <th className={`${sumCol} py-2 text-[11px] font-bold text-surface-100 border-b border-surface-600`}>IN</th>
                  )}
                  <th className="w-12 min-w-12 text-center py-2 text-[11px] font-bold text-surface-50 bg-surface-600 border-b border-surface-600">TOT</th>
                </tr>
                <tr>
                  <td className="sticky left-0 z-10 bg-surface-700 px-3 py-1 text-[11px] font-semibold text-surface-300 border-b border-surface-600">
                    PAR
                  </td>
                  {front.map((h) => (
                    <td key={h.number} className={`${numCol} py-1 text-[11px] text-surface-200 bg-surface-700 border-b border-surface-600`}>
                      {h.par}
                    </td>
                  ))}
                  <td className={`${sumCol} py-1 text-[11px] font-bold text-surface-100 border-b border-surface-600`}>{parSum(front)}</td>
                  {back.map((h) => (
                    <td key={h.number} className={`${numCol} py-1 text-[11px] text-surface-200 bg-surface-700 border-b border-surface-600`}>
                      {h.par}
                    </td>
                  ))}
                  {back.length > 0 && (
                    <td className={`${sumCol} py-1 text-[11px] font-bold text-surface-100 border-b border-surface-600`}>{parSum(back)}</td>
                  )}
                  <td className="w-12 min-w-12 text-center py-1 text-[11px] font-bold text-surface-100 bg-surface-600 border-b border-surface-600">
                    {parSum(round.holes)}
                  </td>
                </tr>
              </thead>
              <tbody>
                {round.players.map((player) => {
                  const canScore = canScoreForPlayer(player.id);
                  const outSum = sumFor(player.id, frontNums);
                  const inSum = sumFor(player.id, backNums);
                  const total = sumFor(player.id, allNums);

                  const cell = (h: HoleInfo) => {
                    const strokes = scoreOf(player.id, h.number);
                    const par = parFor(player.id, h.number);
                    return (
                      <td key={h.number} className="p-0 border-b border-surface-700">
                        <button
                          disabled={!canScore}
                          onClick={() =>
                            canScore && setActiveInput({ playerId: player.id, holeNumber: h.number })
                          }
                          className={`${numCol} h-10 flex items-center justify-center mx-auto ${
                            canScore ? 'hover:bg-surface-700/60' : 'cursor-default'
                          }`}
                        >
                          {strokes === null ? (
                            <span className="text-sm text-surface-500">·</span>
                          ) : (
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center text-sm tabular-nums ${scoreShape(
                                strokes,
                                par
                              )}`}
                            >
                              {strokes}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  };

                  return (
                    <tr key={player.id} className={canScore ? '' : 'opacity-80'}>
                      <td className="sticky left-0 z-10 bg-surface-800 px-3 py-1.5 border-b border-surface-700">
                        <span className="block text-xs font-medium text-surface-50 truncate max-w-[100px]">
                          {player.displayName}
                          {player.isGuest && <span className="ml-1 text-surface-400">(G)</span>}
                        </span>
                      </td>
                      {front.map(cell)}
                      <td className={`${sumCol} h-10 text-sm font-bold text-surface-50 border-b border-surface-700`}>
                        {outSum ?? '–'}
                      </td>
                      {back.map(cell)}
                      {back.length > 0 && (
                        <td className={`${sumCol} h-10 text-sm font-bold text-surface-50 border-b border-surface-700`}>
                          {inSum ?? '–'}
                        </td>
                      )}
                      <td className="w-12 min-w-12 text-center h-10 text-sm font-bold text-surface-50 bg-surface-600/60 border-b border-surface-700">
                        {total ?? '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[11px] text-surface-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-red-400 outline outline-1 outline-offset-[2px] outline-red-400" />
            Eagle
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-red-400" />
            Birdie
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 border-2 border-blue-400" />
            Bogey
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 border-2 border-blue-400 outline outline-1 outline-offset-[2px] outline-blue-400" />
            Double+
          </span>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-surface-500">
          Scroll sideways to see all 18 holes. Tap a score to edit it.
        </p>
      </div>

      {/* Jump to the live scoring experience */}
      <div className="px-4 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => router.push(`/rounds/${roundId}/play`)}>
          Play / enter scores
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => router.push(`/rounds/${roundId}/results`)}>
          Results
        </Button>
      </div>

      {activeInput && activePlayer && (
        <ScoreInput
          par={parFor(activePlayer.id, activeInput.holeNumber)}
          currentScore={scoreOf(activePlayer.id, activeInput.holeNumber)}
          playerName={activePlayer.displayName}
          holeNumber={activeInput.holeNumber}
          onSubmit={(strokes) => {
            updateScore(activePlayer.id, activeInput.holeNumber, strokes);
            setActiveInput(null);
          }}
          onCancel={() => setActiveInput(null)}
        />
      )}
    </div>
  );
}
