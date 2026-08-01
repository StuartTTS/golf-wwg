'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeScores, type LiveScore } from '@/hooks/use-realtime-scores';
import { upsertScore } from '@/lib/actions/scores';
import {
  confirmScorecard,
  unlockScorecard,
  confirmFlight,
  finalizeRound,
  unfinalizeRound,
} from '@/lib/actions/rounds';
import { LeaderboardView } from '@/components/play/leaderboard-view';
import { GroupScorecardView } from '@/components/play/group-scorecard-view';
import { ScoreEntryView } from '@/components/play/score-entry-view';
import { ConfirmPanel } from '@/components/play/confirm-panel';
import { type PlayRound, type PlayScore, blankScore } from '@/components/play/shared';

type Tab = 'leaderboard' | 'scorecard' | 'enter';

interface PlayViewProps {
  round: PlayRound;
  initialScores: PlayScore[];
}

/**
 * Resume where the player left off: the first hole the current user hasn't
 * scored yet — so a reconnect/reload doesn't dump them back on hole 1 (scores
 * are already saved server-side). Falls back to the last hole once every hole
 * is scored, or hole 1 if we can't determine the user's holes.
 */
function resumeHoleIndex(round: PlayRound, scores: PlayScore[]): number {
  const me = round.currentUserId;
  if (!me) return 0;
  const currentUser = round.players.find((p) => p.id === me);
  const holes =
    (currentUser && round.holesByTeeBox[currentUser.teeBoxId]) ||
    round.defaultHoles;
  if (!holes || holes.length === 0) return 0;
  const scored = new Set(
    scores
      .filter((s) => s.playerId === me && s.strokes != null)
      .map((s) => s.holeNumber)
  );
  const idx = holes.findIndex((h) => !scored.has(h.number));
  return idx === -1 ? holes.length - 1 : idx;
}

export default function PlayView({ round, initialScores }: PlayViewProps) {
  const router = useRouter();
  const roundId = round.id;

  const [tab, setTab] = useState<Tab>('enter');
  const [scores, setScores] = useState<PlayScore[]>(initialScores);
  const [holeIndex, setHoleIndex] = useState(() =>
    resumeHoleIndex(round, initialScores)
  );
  const [saving, setSaving] = useState(false);

  // Scorecard confirmation (tiers 1–3). See docs/round-confirmation-lock.md.
  // `confirmed` = round finalized (tier 3); `confirmedCards` = per-card locks
  // (tiers 1–2) keyed by roundPlayerId so score entry can lock in step.
  const [confirmed, setConfirmed] = useState(round.confirmed);
  const [confirmedCards, setConfirmedCards] = useState<Record<string, boolean>>(
    () => Object.fromEntries(round.players.map((p) => [p.roundPlayerId, p.confirmed]))
  );
  const [working, setWorking] = useState<string | null>(null); // roundPlayerId | flightId | 'round'
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const setCards = useCallback(
    (ids: string[], value: boolean) =>
      setConfirmedCards((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = value;
        return next;
      }),
    []
  );

  const handleConfirmCard = useCallback(
    async (roundPlayerId: string) => {
      setWorking(roundPlayerId);
      setConfirmError(null);
      const res = await confirmScorecard(roundPlayerId);
      setWorking(null);
      if (res.error) return setConfirmError(res.error);
      setCards([roundPlayerId], true);
      router.refresh();
    },
    [setCards, router]
  );

  const handleUnlockCard = useCallback(
    async (roundPlayerId: string) => {
      setWorking(roundPlayerId);
      setConfirmError(null);
      const res = await unlockScorecard(roundPlayerId);
      setWorking(null);
      if (res.error) return setConfirmError(res.error);
      setCards([roundPlayerId], false);
      router.refresh();
    },
    [setCards, router]
  );

  const handleConfirmFlight = useCallback(
    async (flightId: string) => {
      setWorking(flightId);
      setConfirmError(null);
      const res = await confirmFlight(flightId);
      setWorking(null);
      if (res.error) return setConfirmError(res.error);
      setCards(
        round.players.filter((p) => p.teeTimeGroupId === flightId).map((p) => p.roundPlayerId),
        true
      );
      router.refresh();
    },
    [setCards, round.players, router]
  );

  const handleFinalize = useCallback(async () => {
    setWorking('round');
    setConfirmError(null);
    const res = await finalizeRound(roundId);
    setWorking(null);
    if (res.error) return setConfirmError(res.error);
    setConfirmed(true);
    setCards(round.players.map((p) => p.roundPlayerId), true); // finalize auto-confirms stragglers
    router.refresh();
  }, [roundId, setCards, round.players, router]);

  const handleReopen = useCallback(async () => {
    setWorking('round');
    setConfirmError(null);
    const res = await unfinalizeRound(roundId);
    setWorking(null);
    if (res.error) return setConfirmError(res.error);
    setConfirmed(false); // cards stay individually locked until unlocked
    router.refresh();
  }, [roundId, router]);

  // Player ids whose card is locked from edits: any confirmed card, or the
  // whole round once finalized. ScoreEntryView uses this to disable inputs.
  const lockedPlayerIds = useMemo(
    () =>
      new Set(
        round.players
          .filter((p) => confirmed || (confirmedCards[p.roundPlayerId] ?? p.confirmed))
          .map((p) => p.id)
      ),
    [round.players, confirmed, confirmedCards]
  );

  // Keep a ref so updateScore always merges against the latest state.
  const scoresRef = useRef(scores);
  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  // Merge live remote strokes + pickup (leaves locally-entered stats intact).
  const applyRemote = useCallback((remote: LiveScore[]) => {
    setScores((prev) => {
      let next = prev;
      for (const r of remote) {
        if (!r.playerId) continue;
        const idx = next.findIndex(
          (s) => s.playerId === r.playerId && s.holeNumber === r.holeNumber
        );
        if (idx >= 0) {
          if (next === prev) next = [...prev];
          next[idx] = { ...next[idx], strokes: r.strokes, pickup: r.pickup };
        } else {
          if (next === prev) next = [...prev];
          next.push({
            ...blankScore(r.playerId, r.holeNumber),
            strokes: r.strokes,
            pickup: r.pickup,
          });
        }
      }
      return next === prev ? prev : next;
    });
  }, []);

  useRealtimeScores({ roundId, onScoreChange: applyRemote });

  const updateScore = useCallback(
    (playerId: string, holeNumber: number, patch: Partial<PlayScore>) => {
      const existing =
        scoresRef.current.find(
          (s) => s.playerId === playerId && s.holeNumber === holeNumber
        ) ?? blankScore(playerId, holeNumber);
      const merged: PlayScore = { ...existing, ...patch };

      // Optimistic update
      setScores((prev) => {
        const idx = prev.findIndex(
          (s) => s.playerId === playerId && s.holeNumber === holeNumber
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = merged;
          return next;
        }
        return [...prev, merged];
      });

      setSaving(true);
      upsertScore({
        roundId,
        playerId,
        holeNumber,
        strokes: merged.strokes,
        pickup: merged.pickup,
        putts: merged.putts,
        fairwayHit: merged.fairwayHit,
        fairwayMiss: merged.fairwayMiss,
        gir: merged.gir,
        greenMiss: merged.greenMiss,
        fairwayBunker: merged.fairwayBunker,
        greensideBunker: merged.greensideBunker,
        penalties: merged.penalties,
        upAndDown: merged.upAndDown,
      })
        .then((res) => {
          if (res.error) console.error('Failed to save score:', res.error);
        })
        .finally(() => setSaving(false));
    },
    [roundId]
  );

  return (
    <div className="min-h-screen">
      {/* Header — single top bar (the global app header is hidden on /play) */}
      <div className="sticky top-0 z-30 bg-surface-900/95 backdrop-blur border-b border-surface-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-golf-500 font-display text-lg font-extrabold">
            WWG
          </span>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-bold text-surface-50 leading-tight truncate">
              {round.courseName}
            </h1>
            <p className="text-xs text-surface-400 leading-tight">
              {new Date(round.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={() => router.push(`/rounds/${roundId}`)}
            aria-label="Close and return to round"
            className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Active tab content */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-28">
        {tab === 'leaderboard' && (
          <LeaderboardView round={round} scores={scores} />
        )}
        {tab === 'scorecard' && (
          <GroupScorecardView round={round} scores={scores} />
        )}
        {tab === 'enter' && (
          <ScoreEntryView
            round={round}
            scores={scores}
            holeIndex={holeIndex}
            setHoleIndex={setHoleIndex}
            updateScore={updateScore}
            saving={saving}
            lockedPlayerIds={lockedPlayerIds}
          />
        )}

        {/* Scorecard confirmation — tiers 1–3, collapsed into one panel */}
        <ConfirmPanel
          round={round}
          scores={scores}
          confirmedCards={confirmedCards}
          finalized={confirmed}
          working={working}
          error={confirmError}
          onConfirmCard={handleConfirmCard}
          onUnlockCard={handleUnlockCard}
          onConfirmFlight={handleConfirmFlight}
          onFinalize={handleFinalize}
          onReopen={handleReopen}
          onViewStats={() => router.push('/profile/stats')}
        />
      </div>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-surface-900/95 backdrop-blur border-t border-surface-700"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto grid grid-cols-3">
          <TabButton
            active={tab === 'leaderboard'}
            label="Leaderboard"
            onClick={() => setTab('leaderboard')}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 11h14l-1 9H6l-1-9z"
              />
            }
          />
          <TabButton
            active={tab === 'scorecard'}
            label="Scorecard"
            onClick={() => setTab('scorecard')}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            }
          />
          <TabButton
            active={tab === 'enter'}
            label="Enter"
            onClick={() => setTab('enter')}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            }
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${
        active ? 'text-golf-400' : 'text-surface-400 hover:text-surface-200'
      }`}
    >
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {icon}
      </svg>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
