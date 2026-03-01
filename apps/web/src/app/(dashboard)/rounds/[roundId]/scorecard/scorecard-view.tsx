'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeScores } from '@/hooks/use-realtime-scores';
import { upsertScore } from '@/lib/actions/scores';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
  holes: HoleInfo[]; // default tee box holes (for navigation / hole count)
  holesByTeeBox: Record<string, HoleInfo[]>;
  currentUserGroupId: string | null;
}

/** Calculate how many strokes a player receives on a given hole. */
function strokesReceivedOnHole(playingHandicap: number, holeStrokeIndex: number): number {
  if (playingHandicap >= 0) {
    let strokes = Math.floor(playingHandicap / 18);
    const remainder = playingHandicap % 18;
    if (holeStrokeIndex <= remainder) strokes += 1;
    return strokes;
  } else {
    const abs = Math.abs(playingHandicap);
    let strokes = -Math.floor(abs / 18);
    const remainder = abs % 18;
    if (holeStrokeIndex > 18 - remainder) strokes -= 1;
    return strokes;
  }
}

/** Render small dots indicating strokes received. */
function StrokeDots({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-1.5 h-1.5 rounded-full bg-gold-500" />
      ))}
    </div>
  );
}

function ScoreCell({
  score,
  par,
  isActive,
  onTap,
  strokesReceived,
}: {
  score: number | null;
  par: number;
  isActive: boolean;
  onTap: () => void;
  strokesReceived: number;
}) {
  const getScoreColor = (strokes: number | null, holePar: number) => {
    if (strokes === null) return '';
    const diff = strokes - holePar;
    if (diff <= -2) return 'bg-score-eagle/20 text-score-eagle font-bold';
    if (diff === -1) return 'bg-score-birdie/20 text-score-birdie font-semibold';
    if (diff === 0) return 'text-surface-50';
    if (diff === 1) return 'bg-score-bogey/20 text-score-bogey';
    if (diff >= 2) return 'bg-score-double/20 text-score-double';
    return '';
  };

  const getScoreBorder = (strokes: number | null, holePar: number) => {
    if (strokes === null) return '';
    const diff = strokes - holePar;
    if (diff <= -2) return 'ring-2 ring-gold-500 rounded-full';
    if (diff === -1) return 'ring-2 ring-red-400 rounded-full';
    if (diff === 1) return 'border border-blue-500';
    if (diff >= 2) return 'border-2 border-blue-700';
    return '';
  };

  return (
    <button
      onClick={onTap}
      className={`
        w-10 h-10 flex flex-col items-center justify-center text-sm relative
        transition-all duration-150 select-none
        ${isActive ? 'ring-2 ring-golf-500 bg-golf-900/30' : 'hover:bg-surface-700'}
        ${getScoreColor(score, par)}
        ${getScoreBorder(score, par)}
      `}
    >
      {score ?? '-'}
      {strokesReceived > 0 && (
        <div className="absolute bottom-0.5 flex gap-0.5">
          {Array.from({ length: strokesReceived }, (_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-gold-500" />
          ))}
        </div>
      )}
    </button>
  );
}

function ScoreInput({
  par,
  currentScore,
  playerName,
  holeNumber,
  strokesReceived,
  onSubmit,
  onCancel,
}: {
  par: number;
  currentScore: number | null;
  playerName: string;
  holeNumber: number;
  strokesReceived: number;
  onSubmit: (score: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<number>(currentScore ?? par);

  const quickScores = useMemo(() => {
    const base = par;
    return [base - 2, base - 1, base, base + 1, base + 2, base + 3];
  }, [par]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface-800 w-full max-w-sm rounded-2xl p-6 space-y-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-300">
              Hole {holeNumber} &middot; Par {par}
              {strokesReceived > 0 && (
                <span className="inline-flex items-center gap-1 ml-2">
                  &middot;
                  <span className="inline-flex gap-0.5 ml-0.5">
                    {Array.from({ length: strokesReceived }, (_, i) => (
                      <span key={i} className="inline-block w-2 h-2 rounded-full bg-gold-500" />
                    ))}
                  </span>
                </span>
              )}
            </p>
            <p className="text-lg font-semibold">{playerName}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-surface-400 hover:text-surface-200 p-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setValue((v) => Math.max(1, v - 1))}
            className="w-14 h-14 rounded-full bg-surface-700 hover:bg-surface-600 flex items-center justify-center text-2xl font-bold transition-colors"
          >
            -
          </button>
          <span className="text-5xl font-bold tabular-nums w-20 text-center">
            {value}
          </span>
          <button
            onClick={() => setValue((v) => Math.min(15, v + 1))}
            className="w-14 h-14 rounded-full bg-surface-700 hover:bg-surface-600 flex items-center justify-center text-2xl font-bold transition-colors"
          >
            +
          </button>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {quickScores.map((qs) => (
            <button
              key={qs}
              onClick={() => setValue(qs)}
              className={`
                py-2 rounded-lg text-sm font-medium transition-colors
                ${value === qs ? 'bg-golf-600 text-white' : 'bg-surface-700 hover:bg-surface-600 text-surface-100'}
              `}
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

function MobileHoleView({
  hole,
  holeIndex,
  totalHoles,
  players,
  scores,
  onPrev,
  onNext,
  onScoreTap,
  getPlayerParForHole,
  canScoreForPlayer,
  getPlayerStrokeIndex,
}: {
  hole: HoleInfo;
  holeIndex: number;
  totalHoles: number;
  players: Player[];
  scores: Score[];
  onPrev: () => void;
  onNext: () => void;
  onScoreTap: (playerId: string) => void;
  getPlayerParForHole: (playerId: string, holeNumber: number) => number;
  canScoreForPlayer: (playerId: string) => boolean;
  getPlayerStrokeIndex: (playerId: string, holeNumber: number) => number;
}) {
  const getPlayerScore = (playerId: string) => {
    const s = scores.find(
      (sc) => sc.playerId === playerId && sc.holeNumber === hole.number
    );
    return s?.strokes ?? null;
  };

  const getScoreStyle = (strokes: number | null, playerId: string) => {
    if (strokes === null) return 'bg-surface-700 border-surface-500 text-surface-400';
    const par = getPlayerParForHole(playerId, hole.number);
    const diff = strokes - par;
    if (diff <= -2) return 'bg-score-eagle/20 border-score-eagle text-score-eagle';
    if (diff === -1) return 'bg-score-birdie/20 border-score-birdie text-score-birdie';
    if (diff === 0) return 'bg-surface-800 border-surface-500 text-surface-50';
    if (diff === 1) return 'bg-score-bogey/20 border-score-bogey text-score-bogey';
    return 'bg-score-double/20 border-score-double text-score-double';
  };

  const getPlayerTotal = (playerId: string) => {
    const playerScores = scores.filter(
      (s) => s.playerId === playerId && s.strokes !== null
    );
    if (playerScores.length === 0) return null;
    return playerScores.reduce((sum, s) => sum + (s.strokes ?? 0), 0);
  };

  return (
    <div className="space-y-4">
      {/* Hole navigation header */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={onPrev}
          disabled={holeIndex === 0}
          className="p-2 rounded-lg hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-3xl font-bold">Hole {hole.number}</p>
          <div className="flex items-center gap-3 justify-center mt-1">
            <Badge variant="secondary">Par {hole.par}</Badge>
            <span className="text-sm text-surface-300">{hole.yardage} yds</span>
            <span className="text-sm text-surface-300">SI {hole.strokeIndex}</span>
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={holeIndex === totalHoles - 1}
          className="p-2 rounded-lg hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Hole progress dots */}
      <div className="flex justify-center gap-1 px-4 flex-wrap">
        {Array.from({ length: totalHoles }, (_, i) => (
          <div
            key={i}
            className={`
              w-2 h-2 rounded-full transition-colors
              ${i === holeIndex ? 'bg-golf-600 w-4' : i < holeIndex ? 'bg-golf-400' : 'bg-surface-600'}
            `}
          />
        ))}
      </div>

      {/* Player scores for this hole */}
      <div className="space-y-3 px-2">
        {players.map((player) => {
          const score = getPlayerScore(player.id);
          const total = getPlayerTotal(player.id);
          const canScore = canScoreForPlayer(player.id);
          const si = getPlayerStrokeIndex(player.id, hole.number);
          const dots = strokesReceivedOnHole(player.playingHandicap, si);

          return (
            <button
              key={player.id}
              onClick={() => onScoreTap(player.id)}
              disabled={!canScore}
              className={`w-full flex items-center justify-between p-4 rounded-xl bg-surface-800 border transition-all ${
                canScore
                  ? 'border-surface-500 hover:border-golf-400 hover:shadow-sm active:scale-[0.98]'
                  : 'border-surface-600 opacity-60 cursor-default'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                  player.isGuest
                    ? 'bg-surface-600 text-surface-300'
                    : 'bg-emerald-900/40 text-golf-600'
                }`}>
                  {player.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="font-medium text-surface-50">
                    {player.displayName}
                    {player.isGuest && (
                      <span className="ml-2 text-[10px] font-normal text-surface-400 border border-surface-500 rounded px-1 py-0.5">
                        Guest
                      </span>
                    )}
                  </p>
                  {total !== null && (
                    <p className="text-xs text-surface-300">Total: {total}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {dots > 0 && <StrokeDots count={dots} />}
                <div
                  className={`
                    w-14 h-14 rounded-xl border-2 flex items-center justify-center
                    text-xl font-bold transition-colors
                    ${getScoreStyle(score, player.id)}
                  `}
                >
                  {score ?? '-'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DesktopScorecardGrid({
  holes,
  players,
  scores,
  onCellTap,
  activeCell,
  getPlayerParForHole,
  canScoreForPlayer,
  getPlayerStrokeIndex,
}: {
  holes: HoleInfo[];
  players: Player[];
  scores: Score[];
  onCellTap: (playerId: string, holeNumber: number) => void;
  activeCell: { playerId: string; holeNumber: number } | null;
  getPlayerParForHole: (playerId: string, holeNumber: number) => number;
  canScoreForPlayer: (playerId: string) => boolean;
  getPlayerStrokeIndex: (playerId: string, holeNumber: number) => number;
}) {
  const frontNine = holes.filter((h) => h.number <= 9);
  const backNine = holes.filter((h) => h.number > 9);

  const getScore = (playerId: string, holeNumber: number) => {
    const s = scores.find(
      (sc) => sc.playerId === playerId && sc.holeNumber === holeNumber
    );
    return s?.strokes ?? null;
  };

  const getSumForHoles = (playerId: string, holeNumbers: number[]) => {
    let total = 0;
    let hasAny = false;
    for (const hn of holeNumbers) {
      const s = getScore(playerId, hn);
      if (s !== null) {
        total += s;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  };

  const getParSum = (holeList: HoleInfo[]) =>
    holeList.reduce((sum, h) => sum + h.par, 0);

  const renderHoleHeaders = (holeList: HoleInfo[]) =>
    holeList.map((h) => (
      <th
        key={h.number}
        className="w-10 h-8 text-center text-xs font-semibold text-surface-300 border-b border-surface-500"
      >
        {h.number}
      </th>
    ));

  const renderParRow = (holeList: HoleInfo[], label: string, parTotal: number) => (
    <>
      {holeList.map((h) => (
        <td
          key={h.number}
          className="w-10 h-8 text-center text-xs font-medium text-surface-200 bg-surface-700 border-b border-surface-500"
        >
          {h.par}
        </td>
      ))}
      <td className="w-12 h-8 text-center text-xs font-bold text-surface-100 bg-surface-700 border-b border-surface-500">
        {parTotal}
      </td>
    </>
  );

  const renderPlayerScores = (
    player: Player,
    holeList: HoleInfo[],
    sumLabel: string
  ) => {
    const holeNumbers = holeList.map((h) => h.number);
    const subtotal = getSumForHoles(player.id, holeNumbers);

    return (
      <>
        {holeList.map((h) => {
          const score = getScore(player.id, h.number);
          const playerPar = getPlayerParForHole(player.id, h.number);
          const isActive =
            activeCell?.playerId === player.id &&
            activeCell?.holeNumber === h.number;
          const si = getPlayerStrokeIndex(player.id, h.number);
          const received = strokesReceivedOnHole(player.playingHandicap, si);

          return (
            <td key={h.number} className="border-b border-surface-600 p-0">
              <ScoreCell
                score={score}
                par={playerPar}
                isActive={isActive}
                onTap={() => onCellTap(player.id, h.number)}
                strokesReceived={received}
              />
            </td>
          );
        })}
        <td className="w-12 h-10 text-center text-sm font-bold text-surface-100 bg-surface-700 border-b border-surface-600">
          {subtotal ?? '-'}
        </td>
      </>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse min-w-full">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface-800 w-28 text-left px-3 py-2 text-xs font-semibold text-surface-300 border-b border-surface-500">
              HOLE
            </th>
            {renderHoleHeaders(frontNine)}
            <th className="w-12 text-center text-xs font-bold text-surface-100 bg-surface-700 border-b border-surface-500">
              OUT
            </th>
            {renderHoleHeaders(backNine)}
            <th className="w-12 text-center text-xs font-bold text-surface-100 bg-surface-700 border-b border-surface-500">
              IN
            </th>
            <th className="w-14 text-center text-xs font-bold text-surface-50 bg-surface-600 border-b border-surface-500">
              TOT
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Par row */}
          <tr>
            <td className="sticky left-0 z-10 bg-surface-700 px-3 py-1 text-xs font-semibold text-surface-300 border-b border-surface-500">
              PAR
            </td>
            {renderParRow(frontNine, 'OUT', getParSum(frontNine))}
            {renderParRow(backNine, 'IN', getParSum(backNine))}
            <td className="w-14 h-8 text-center text-xs font-bold text-surface-100 bg-surface-600 border-b border-surface-500">
              {getParSum(holes)}
            </td>
          </tr>

          {/* Player rows */}
          {players.map((player) => {
            const frontNumbers = frontNine.map((h) => h.number);
            const backNumbers = backNine.map((h) => h.number);
            const allNumbers = holes.map((h) => h.number);
            const total = getSumForHoles(player.id, allNumbers);
            const canScore = canScoreForPlayer(player.id);

            return (
              <tr key={player.id} className={`group ${!canScore ? 'opacity-60' : ''}`}>
                <td className="sticky left-0 z-10 bg-surface-800 group-hover:bg-surface-700 px-3 py-1 border-b border-surface-600">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-900/40 flex items-center justify-center text-golf-600 text-xs font-semibold">
                      {player.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-surface-50 truncate max-w-[80px]">
                        {player.displayName}
                      </p>
                      {player.handicap !== null && (
                        <p className="text-[10px] text-surface-400">
                          HCP {player.handicap}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                {renderPlayerScores(player, frontNine, 'OUT')}
                {renderPlayerScores(player, backNine, 'IN')}
                <td className="w-14 h-10 text-center text-sm font-bold text-surface-50 bg-surface-700 border-b border-surface-600">
                  {total ?? '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [activeInput, setActiveInput] = useState<{
    playerId: string;
    holeNumber: number;
  } | null>(null);

  const { broadcastEvent } = useRealtimeScores({
    roundId,
    onScoreChange: () => {},
  });

  // Determine if the current user can score for a given player.
  // If no tee time groups exist (all null), anyone can score (current behavior).
  // If groups exist, can only score for players in same group.
  const hasAnyGroups = round.players.some((p) => p.teeTimeGroupId !== null);
  const canScoreForPlayer = useCallback(
    (playerId: string): boolean => {
      if (!hasAnyGroups) return true; // no groups = everyone can score
      if (!round.currentUserGroupId) return true; // user not in a group = allow all
      const player = round.players.find((p) => p.id === playerId);
      return player?.teeTimeGroupId === round.currentUserGroupId;
    },
    [hasAnyGroups, round.currentUserGroupId, round.players]
  );

  // Only show players in the current user's tee time group on the scorecard
  const visiblePlayers = useMemo(() => {
    if (!hasAnyGroups || !round.currentUserGroupId) return round.players;
    return round.players.filter(p => p.teeTimeGroupId === round.currentUserGroupId);
  }, [hasAnyGroups, round.currentUserGroupId, round.players]);

  const [scores, setScores] = useState<Score[]>(initialScores);
  const [saving, setSaving] = useState(false);
  const updateScore = useCallback(async (playerId: string, holeNumber: number, strokes: number | null) => {
    setSaving(true);
    // Optimistic update
    setScores((prev) => {
      const idx = prev.findIndex(
        (s) => s.playerId === playerId && s.holeNumber === holeNumber
      );
      const updated: Score = { playerId, holeNumber, strokes, putts: null, fairwayHit: null, greenInRegulation: null };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });

    const result = await upsertScore({
      roundId,
      playerId,
      holeNumber,
      strokes,
    });

    if (result.error) {
      console.error('Failed to save score:', result.error);
      // Revert optimistic update on error
      setScores((prev) =>
        prev.filter(
          (s) => !(s.playerId === playerId && s.holeNumber === holeNumber)
        )
      );
    }

    setSaving(false);
  }, [roundId]);

  // Helper: get a specific player's holes (from their tee box)
  const getPlayerHoles = useCallback((playerId: string): HoleInfo[] => {
    if (!round) return [];
    const player = round.players.find(p => p.id === playerId);
    return round.holesByTeeBox[player?.teeBoxId ?? '']
      ?? Object.values(round.holesByTeeBox)[0]
      ?? [];
  }, [round]);

  // Helper: get par for a specific player + hole number
  const getPlayerPar = useCallback((playerId: string, holeNumber: number): number => {
    const holes = getPlayerHoles(playerId);
    return holes.find(h => h.number === holeNumber)?.par ?? 4;
  }, [getPlayerHoles]);

  // Helper: get stroke index for a specific player + hole number
  const getPlayerStrokeIndex = useCallback((playerId: string, holeNumber: number): number => {
    const holes = getPlayerHoles(playerId);
    return holes.find(h => h.number === holeNumber)?.strokeIndex ?? holeNumber;
  }, [getPlayerHoles]);

  const handleScoreTap = useCallback(
    (playerId: string, holeNumber?: number) => {
      if (!canScoreForPlayer(playerId)) return; // group-scoped: can't score for other groups
      const hole = holeNumber ?? round?.holes[currentHoleIndex]?.number;
      if (!hole) return;
      setActiveInput({ playerId, holeNumber: hole });
    },
    [currentHoleIndex, round, canScoreForPlayer]
  );

  const handleScoreSubmit = useCallback(
    async (strokes: number) => {
      if (!activeInput) return;
      await updateScore(activeInput.playerId, activeInput.holeNumber, strokes);
      setActiveInput(null);
    },
    [activeInput, updateScore]
  );

  const handleScoreCancel = useCallback(() => {
    setActiveInput(null);
  }, []);

  const goToPrevHole = useCallback(() => {
    setCurrentHoleIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToNextHole = useCallback(() => {
    if (!round) return;
    setCurrentHoleIndex((i) => Math.min(round.holes.length - 1, i + 1));
  }, [round]);

  const currentHole = round.holes[currentHoleIndex];
  const activePlayer = activeInput
    ? round.players.find((p) => p.id === activeInput.playerId)
    : null;
  const activeHole = activeInput
    ? round.holes.find((h) => h.number === activeInput.holeNumber)
    : null;
  // Use player-specific par for the score input modal
  const activeHolePar = activeInput && activePlayer
    ? getPlayerPar(activePlayer.id, activeInput.holeNumber)
    : activeHole?.par ?? 4;
  const activeCurrentScore = activeInput
    ? scores.find(
        (s) =>
          s.playerId === activeInput.playerId &&
          s.holeNumber === activeInput.holeNumber
      )?.strokes ?? null
    : null;

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20">
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
          {saving && (
            <span className="text-xs text-surface-400 animate-pulse">Saving...</span>
          )}
          <Badge
            variant={round.status === 'in_progress' ? 'default' : 'secondary'}
          >
            {round.status === 'in_progress' ? 'Live' : round.status}
          </Badge>
        </div>
      </div>

      {/* Mobile view (default) - single hole at a time */}
      <div className="block lg:hidden px-4">
        {currentHole && (
          <MobileHoleView
            hole={currentHole}
            holeIndex={currentHoleIndex}
            totalHoles={round.holes.length}
            players={visiblePlayers}
            scores={scores as any}
            onPrev={goToPrevHole}
            onNext={goToNextHole}
            onScoreTap={(playerId) => handleScoreTap(playerId)}
            getPlayerParForHole={getPlayerPar}
            canScoreForPlayer={canScoreForPlayer}
            getPlayerStrokeIndex={getPlayerStrokeIndex}
          />
        )}
      </div>

      {/* Desktop view - full grid */}
      <div className="hidden lg:block px-4">
        <Card>
          <DesktopScorecardGrid
            holes={round.holes}
            players={visiblePlayers}
            scores={scores as any}
            onCellTap={(playerId, holeNumber) =>
              handleScoreTap(playerId, holeNumber)
            }
            activeCell={activeInput}
            getPlayerParForHole={getPlayerPar}
            canScoreForPlayer={canScoreForPlayer}
            getPlayerStrokeIndex={getPlayerStrokeIndex}
          />
        </Card>
      </div>

      {/* Quick summary bar (mobile) */}
      <div className="block lg:hidden px-4">
        <Card>
          <div className="p-3">
            <h3 className="text-xs font-semibold text-surface-300 uppercase tracking-wide mb-2">
              Totals
            </h3>
            <div className="space-y-2">
              {visiblePlayers.map((player) => {
                const playerScores = scores.filter(
                  (s) => s.playerId === player.id && s.strokes !== null
                );
                const totalStrokes = playerScores.reduce(
                  (sum, s) => sum + (s.strokes ?? 0),
                  0
                );
                const playerHoles = getPlayerHoles(player.id);
                const totalPar = playerHoles
                  .filter((h) =>
                    playerScores.some((s) => s.holeNumber === h.number)
                  )
                  .reduce((sum, h) => sum + h.par, 0);
                const toPar = totalStrokes - totalPar;
                const holesPlayed = playerScores.length;

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium text-surface-100">
                      {player.displayName}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-surface-400">
                        {holesPlayed} holes
                      </span>
                      {holesPlayed > 0 && (
                        <>
                          <span className="text-sm font-bold tabular-nums">
                            {totalStrokes}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              toPar < 0
                                ? 'text-red-400'
                                : toPar > 0
                                ? 'text-blue-600'
                                : 'text-surface-200'
                            }`}
                          >
                            {toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : toPar}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation buttons (mobile) */}
      <div className="block lg:hidden px-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push(`/rounds/${roundId}/games`)}
          >
            Games
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push(`/rounds/${roundId}/results`)}
          >
            Results
          </Button>
        </div>
      </div>

      {/* Score input modal */}
      {activeInput && activePlayer && activeHole && (
        <ScoreInput
          par={activeHolePar}
          currentScore={activeCurrentScore}
          playerName={activePlayer.displayName}
          holeNumber={activeInput.holeNumber}
          strokesReceived={strokesReceivedOnHole(
            activePlayer.playingHandicap,
            getPlayerStrokeIndex(activePlayer.id, activeInput.holeNumber)
          )}
          onSubmit={handleScoreSubmit}
          onCancel={handleScoreCancel}
        />
      )}
    </div>
  );
}
