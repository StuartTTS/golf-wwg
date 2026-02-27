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
        w-10 h-10 flex items-center justify-center text-sm
        transition-all duration-150 select-none
        ${isActive ? 'ring-2 ring-golf-500 bg-golf-900/30' : 'hover:bg-surface-700'}
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
      <div className="bg-surface-800 w-full sm:w-96 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-300">
              Hole {holeNumber} &middot; Par {par}
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

          return (
            <button
              key={player.id}
              onClick={() => onScoreTap(player.id)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-800 border border-surface-500 hover:border-golf-400 hover:shadow-sm transition-all active:scale-[0.98]"
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

              <div
                className={`
                  w-14 h-14 rounded-xl border-2 flex items-center justify-center
                  text-xl font-bold transition-colors
                  ${getScoreStyle(score, player.id)}
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
  getPlayerParForHole,
}: {
  holes: HoleInfo[];
  players: Player[];
  scores: Score[];
  onCellTap: (playerId: string, holeNumber: number) => void;
  activeCell: { playerId: string; holeNumber: number } | null;
  getPlayerParForHole: (playerId: string, holeNumber: number) => number;
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

          return (
            <td key={h.number} className="border-b border-surface-600 p-0">
              <ScoreCell
                score={score}
                par={playerPar}
                isActive={isActive}
                onTap={() => onCellTap(player.id, h.number)}
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

            return (
              <tr key={player.id} className="group">
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
              id,
              user_id,
              tee_box_id,
              guest_name,
              guest_handicap_index,
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

        // Load holes for ALL unique tee boxes so each player gets correct pars
        const uniqueTeeBoxIds = [...new Set(
          roundData.round_players.map((rp: any) => rp.tee_box_id).filter(Boolean)
        )];

        const { data: allHolesData, error: holesError } = await supabase
          .from('holes')
          .select('hole_number, par, handicap_index, yardage, tee_box_id')
          .in('tee_box_id', uniqueTeeBoxIds)
          .order('hole_number');

        if (holesError) throw holesError;

        const holesByTeeBox: Record<string, HoleInfo[]> = {};
        for (const h of (allHolesData ?? [])) {
          if (!holesByTeeBox[h.tee_box_id]) holesByTeeBox[h.tee_box_id] = [];
          holesByTeeBox[h.tee_box_id].push({
            number: h.hole_number,
            par: h.par,
            strokeIndex: h.handicap_index,
            yardage: h.yardage ?? 0,
          });
        }

        // Use the first tee box's holes as default for navigation (hole numbers are the same)
        const defaultHoles = Object.values(holesByTeeBox)[0] ?? [];

        setRound({
          id: roundData.id,
          courseId: roundData.course_id,
          courseName: roundData.courses?.name ?? 'Unknown Course',
          status: roundData.status as any,
          date: roundData.round_date,
          players: roundData.round_players.map((rp: any) => {
            const isGuest = !rp.user_id;
            return {
              id: isGuest ? rp.id : rp.profiles.id,
              displayName: isGuest ? rp.guest_name : rp.profiles.display_name,
              handicap: isGuest ? rp.guest_handicap_index : rp.profiles.handicap,
              teeBoxId: rp.tee_box_id,
              isGuest,
            };
          }),
          holes: defaultHoles,
          holesByTeeBox,
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
          <div className="w-8 h-8 border-2 border-golf-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-300">Loading scorecard...</p>
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
            <p className="text-sm text-surface-300">
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
            players={round.players}
            scores={scores as any}
            onPrev={goToPrevHole}
            onNext={goToNextHole}
            onScoreTap={(playerId) => handleScoreTap(playerId)}
            getPlayerParForHole={getPlayerPar}
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
            getPlayerParForHole={getPlayerPar}
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
              {round.players.map((player) => {
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
          onSubmit={handleScoreSubmit}
          onCancel={handleScoreCancel}
        />
      )}
    </div>
  );
}
