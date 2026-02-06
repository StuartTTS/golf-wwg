'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/supabase-provider';
import { useRealtimeScores } from '@/hooks/use-realtime-scores';

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
  teeBoxId: string;
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
  holes: HoleInfo[];
}

function ScoreCell({
  score,
  par,
  isActive,
  onTap,
}: {
  score: number | null;
  par: number;
  isActive: boolean;
  onTap: () => void;
}) {
  const getScoreColor = (strokes: number | null, holePar: number) => {
    if (strokes === null) return '';
    const diff = strokes - holePar;
    if (diff <= -2) return 'bg-yellow-400 text-yellow-900 font-bold';
    if (diff === -1) return 'bg-red-900/300 text-white font-semibold';
    if (diff === 0) return 'text-dark-900';
    if (diff === 1) return 'bg-blue-500 text-white';
    if (diff >= 2) return 'bg-blue-800 text-white';
    return '';
  };

  const getScoreBorder = (strokes: number | null, holePar: number) => {
    if (strokes === null) return '';
    const diff = strokes - holePar;
    if (diff <= -2) return 'ring-2 ring-yellow-500 rounded-full';
    if (diff === -1) return 'ring-2 ring-red-400 rounded-full';
    if (diff === 1) return 'border border-blue-500';
    if (diff >= 2) return 'border-2 border-blue-700';
    return '';
  };

  return (
    <button
      onClick={onTap}
      className={`
        w-10 h-10 flex items-center justify-center text-sm
        transition-all duration-150 select-none
        ${isActive ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-dark-50'}
        ${getScoreColor(score, par)}
        ${getScoreBorder(score, par)}
      `}
    >
      {score ?? '-'}
    </button>
  );
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

  const quickScores = useMemo(() => {
    const base = par;
    return [base - 2, base - 1, base, base + 1, base + 2, base + 3];
  }, [par]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-dark-100 w-full sm:w-96 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-dark-600">
              Hole {holeNumber} &middot; Par {par}
            </p>
            <p className="text-lg font-semibold">{playerName}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-dark-500 hover:text-dark-700 p-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setValue((v) => Math.max(1, v - 1))}
            className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-2xl font-bold transition-colors"
          >
            -
          </button>
          <span className="text-5xl font-bold tabular-nums w-20 text-center">
            {value}
          </span>
          <button
            onClick={() => setValue((v) => Math.min(15, v + 1))}
            className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-2xl font-bold transition-colors"
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
                ${value === qs ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-dark-800'}
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
}: {
  hole: HoleInfo;
  holeIndex: number;
  totalHoles: number;
  players: Player[];
  scores: Score[];
  onPrev: () => void;
  onNext: () => void;
  onScoreTap: (playerId: string) => void;
}) {
  const getPlayerScore = (playerId: string) => {
    const s = scores.find(
      (sc) => sc.playerId === playerId && sc.holeNumber === hole.number
    );
    return s?.strokes ?? null;
  };

  const getScoreStyle = (strokes: number | null) => {
    if (strokes === null) return 'bg-dark-50 border-dark-300 text-dark-500';
    const diff = strokes - hole.par;
    if (diff <= -2) return 'bg-yellow-900/40 border-yellow-400 text-yellow-800';
    if (diff === -1) return 'bg-red-900/30 border-red-400 text-red-400';
    if (diff === 0) return 'bg-dark-100 border-gray-300 text-dark-900';
    if (diff === 1) return 'bg-blue-50 border-blue-400 text-blue-400';
    return 'bg-blue-900/40 border-blue-600 text-blue-900';
  };

  const getPlayerTotal = (playerId: string) => {
    const playerScores = scores.filter(
      (s) => s.playerId === playerId && s.strokes !== null
    );
    if (playerScores.length === 0) return null;
    return playerScores.reduce((sum, s) => sum + (s.strokes ?? 0), 0);
  };

  const getPlayerToPar = (playerId: string) => {
    let totalStrokes = 0;
    let totalPar = 0;
    scores
      .filter((s) => s.playerId === playerId && s.strokes !== null)
      .forEach((s) => {
        totalStrokes += s.strokes ?? 0;
        const h = players.length > 0 ? hole : null;
        // Look up the hole par from the scores context
      });
    // Simplified: return score vs par for scored holes
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Hole navigation header */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={onPrev}
          disabled={holeIndex === 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-3xl font-bold">Hole {hole.number}</p>
          <div className="flex items-center gap-3 justify-center mt-1">
            <Badge variant="secondary">Par {hole.par}</Badge>
            <span className="text-sm text-dark-600">{hole.yardage} yds</span>
            <span className="text-sm text-dark-600">SI {hole.strokeIndex}</span>
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={holeIndex === totalHoles - 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
              ${i === holeIndex ? 'bg-green-600 w-4' : i < holeIndex ? 'bg-green-300' : 'bg-gray-200'}
            `}
          />
        ))}
      </div>

      {/* Player scores for this hole */}
      <div className="space-y-3 px-2">
        {players.map((player) => {
          const score = getPlayerScore(player.id);
          const total = getPlayerTotal(player.id);

          return (
            <button
              key={player.id}
              onClick={() => onScoreTap(player.id)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-dark-100 border border-dark-300 hover:border-green-300 hover:shadow-sm transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-900/40 flex items-center justify-center text-golf-600 font-semibold text-sm">
                  {player.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="font-medium text-dark-900">{player.displayName}</p>
                  {total !== null && (
                    <p className="text-xs text-dark-600">Total: {total}</p>
                  )}
                </div>
              </div>

              <div
                className={`
                  w-14 h-14 rounded-xl border-2 flex items-center justify-center
                  text-xl font-bold transition-colors
                  ${getScoreStyle(score)}
                `}
              >
                {score ?? '-'}
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
}: {
  holes: HoleInfo[];
  players: Player[];
  scores: Score[];
  onCellTap: (playerId: string, holeNumber: number) => void;
  activeCell: { playerId: string; holeNumber: number } | null;
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
        className="w-10 h-8 text-center text-xs font-semibold text-dark-600 border-b border-dark-300"
      >
        {h.number}
      </th>
    ));

  const renderParRow = (holeList: HoleInfo[], label: string, parTotal: number) => (
    <>
      {holeList.map((h) => (
        <td
          key={h.number}
          className="w-10 h-8 text-center text-xs font-medium text-dark-700 bg-dark-50 border-b border-dark-300"
        >
          {h.par}
        </td>
      ))}
      <td className="w-12 h-8 text-center text-xs font-bold text-dark-800 bg-gray-100 border-b border-dark-300">
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
          const isActive =
            activeCell?.playerId === player.id &&
            activeCell?.holeNumber === h.number;

          return (
            <td key={h.number} className="border-b border-gray-100 p-0">
              <ScoreCell
                score={score}
                par={h.par}
                isActive={isActive}
                onTap={() => onCellTap(player.id, h.number)}
              />
            </td>
          );
        })}
        <td className="w-12 h-10 text-center text-sm font-bold text-gray-800 bg-dark-50 border-b border-gray-100">
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
            <th className="sticky left-0 z-10 bg-dark-100 w-28 text-left px-3 py-2 text-xs font-semibold text-dark-600 border-b border-dark-300">
              HOLE
            </th>
            {renderHoleHeaders(frontNine)}
            <th className="w-12 text-center text-xs font-bold text-dark-800 bg-gray-100 border-b border-dark-300">
              OUT
            </th>
            {renderHoleHeaders(backNine)}
            <th className="w-12 text-center text-xs font-bold text-dark-800 bg-gray-100 border-b border-dark-300">
              IN
            </th>
            <th className="w-14 text-center text-xs font-bold text-dark-900 bg-gray-200 border-b border-dark-300">
              TOT
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Par row */}
          <tr>
            <td className="sticky left-0 z-10 bg-dark-50 px-3 py-1 text-xs font-semibold text-dark-600 border-b border-dark-300">
              PAR
            </td>
            {renderParRow(frontNine, 'OUT', getParSum(frontNine))}
            {renderParRow(backNine, 'IN', getParSum(backNine))}
            <td className="w-14 h-8 text-center text-xs font-bold text-gray-800 bg-gray-200 border-b border-dark-300">
              {getParSum(holes)}
            </td>
          </tr>

          {/* Player rows */}
          {players.map((player) => {
            const frontNumbers = frontNine.map((h) => h.number);
            const backNumbers = backNine.map((h) => h.number);
            const allNumbers = holes.map((h) => h.number);
            const total = getSumForHoles(player.id, allNumbers);

            return (
              <tr key={player.id} className="group">
                <td className="sticky left-0 z-10 bg-dark-100 group-hover:bg-dark-50 px-3 py-1 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-900/40 flex items-center justify-center text-golf-600 text-xs font-semibold">
                      {player.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-dark-900 truncate max-w-[80px]">
                        {player.displayName}
                      </p>
                      {player.handicap !== null && (
                        <p className="text-[10px] text-dark-500">
                          HCP {player.handicap}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                {renderPlayerScores(player, frontNine, 'OUT')}
                {renderPlayerScores(player, backNine, 'IN')}
                <td className="w-14 h-10 text-center text-sm font-bold text-dark-900 bg-gray-100 border-b border-gray-100">
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

export default function ScorecardPage() {
  const params = useParams<{ roundId: string }>();
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const roundId = params.roundId;

  const [round, setRound] = useState<RoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [activeInput, setActiveInput] = useState<{
    playerId: string;
    holeNumber: number;
  } | null>(null);

  const { broadcastEvent } = useRealtimeScores({
    roundId,
    onScoreChange: () => {},
  });

  const [scores, setScores] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const updateScore = async (playerId: string, holeNumber: number, strokes: number | null) => {
    // Will be implemented properly later
  };

  // Fetch round data
  useEffect(() => {
    async function fetchRound() {
      if (!supabase || !roundId) return;

      try {
        setLoading(true);

        const { data: roundData, error: roundError } = await supabase
          .from('rounds')
          .select(`
            id,
            course_id,
            status,
            round_date,
            courses (
              id,
              name
            ),
            round_players (
              user_id,
              tee_box_id,
              profiles:profiles!round_players_user_id_fkey (
                id,
                display_name,
                current_handicap_index
              )
            )
          `)
          .eq('id', roundId)
          .single();

        if (roundError) throw roundError;

        const { data: holesData, error: holesError } = await supabase
          .from('holes')
          .select('hole_number, par, handicap_index, yardage, tee_box_id')
          .eq('tee_box_id', roundData.round_players[0]?.tee_box_id)
          .order('hole_number');

        if (holesError) throw holesError;

        setRound({
          id: roundData.id,
          courseId: roundData.course_id,
          courseName: roundData.courses?.name ?? 'Unknown Course',
          status: roundData.status as any,
          date: roundData.round_date,
          players: roundData.round_players.map((rp: any) => ({
            id: rp.profiles.id,
            displayName: rp.profiles.display_name,
            handicap: rp.profiles.handicap,
            teeBoxId: rp.tee_box_id,
          })),
          holes: holesData.map((h: any) => ({
            number: h.hole_number,
            par: h.par,
            strokeIndex: h.handicap_index,
            yardage: h.yardage,
          })),
        });
      } catch (err: any) {
        setError(err.message ?? 'Failed to load round');
      } finally {
        setLoading(false);
      }
    }

    fetchRound();
  }, [supabase, roundId]);

  const handleScoreTap = useCallback(
    (playerId: string, holeNumber?: number) => {
      const hole = holeNumber ?? round?.holes[currentHoleIndex]?.number;
      if (!hole) return;
      setActiveInput({ playerId, holeNumber: hole });
    },
    [currentHoleIndex, round]
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-dark-600">Loading scorecard...</p>
        </div>
      </div>
    );
  }

  if (error || !round) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-sm w-full">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
            <p className="text-sm text-dark-600">
              {error ?? 'Round not found'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.back()}
            >
              Go Back
            </Button>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const currentHole = round.holes[currentHoleIndex];
  const activePlayer = activeInput
    ? round.players.find((p) => p.id === activeInput.playerId)
    : null;
  const activeHole = activeInput
    ? round.holes.find((h) => h.number === activeInput.holeNumber)
    : null;
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
          <h1 className="text-xl font-bold text-dark-900">{round.courseName}</h1>
          <p className="text-sm text-dark-600">
            {new Date(round.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-dark-500 animate-pulse">Saving...</span>
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
            players={round.players}
            scores={scores as any}
            onPrev={goToPrevHole}
            onNext={goToNextHole}
            onScoreTap={(playerId) => handleScoreTap(playerId)}
          />
        )}
      </div>

      {/* Desktop view - full grid */}
      <div className="hidden lg:block px-4">
        <Card>
          <DesktopScorecardGrid
            holes={round.holes}
            players={round.players}
            scores={scores as any}
            onCellTap={(playerId, holeNumber) =>
              handleScoreTap(playerId, holeNumber)
            }
            activeCell={activeInput}
          />
        </Card>
      </div>

      {/* Quick summary bar (mobile) */}
      <div className="block lg:hidden px-4">
        <Card>
          <div className="p-3">
            <h3 className="text-xs font-semibold text-dark-600 uppercase tracking-wide mb-2">
              Totals
            </h3>
            <div className="space-y-2">
              {round.players.map((player) => {
                const playerScores = scores.filter(
                  (s) => s.playerId === player.id && s.strokes !== null
                );
                const totalStrokes = playerScores.reduce(
                  (sum, s) => sum + (s.strokes ?? 0),
                  0
                );
                const totalPar = round.holes
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
                    <span className="text-sm font-medium text-dark-800">
                      {player.displayName}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-dark-500">
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
                                : 'text-dark-700'
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
          par={activeHole.par}
          currentScore={activeCurrentScore}
          playerName={activePlayer.displayName}
          holeNumber={activeInput.holeNumber}
          onSubmit={handleScoreSubmit}
          onCancel={handleScoreCancel}
        />
      )}
    </div>
  );
}
