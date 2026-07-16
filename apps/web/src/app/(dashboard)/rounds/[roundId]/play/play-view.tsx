'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { HoleScore } from '@golf/core';
import { useRealtimeScores } from '@/hooks/use-realtime-scores';
import { upsertScore } from '@/lib/actions/scores';
import { LeaderboardView } from '@/components/play/leaderboard-view';
import { GroupScorecardView } from '@/components/play/group-scorecard-view';
import { ScoreEntryView } from '@/components/play/score-entry-view';
import { type PlayRound, type PlayScore, blankScore } from '@/components/play/shared';

type Tab = 'leaderboard' | 'scorecard' | 'enter';

interface PlayViewProps {
  round: PlayRound;
  initialScores: PlayScore[];
}

export default function PlayView({ round, initialScores }: PlayViewProps) {
  const router = useRouter();
  const roundId = round.id;

  const [tab, setTab] = useState<Tab>('enter');
  const [scores, setScores] = useState<PlayScore[]>(initialScores);
  const [holeIndex, setHoleIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Keep a ref so updateScore always merges against the latest state.
  const scoresRef = useRef(scores);
  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  // Merge live remote strokes (leaves locally-entered detailed stats intact).
  const applyRemote = useCallback((remote: HoleScore[]) => {
    setScores((prev) => {
      let next = prev;
      for (const r of remote) {
        if (!r.playerId) continue;
        const idx = next.findIndex(
          (s) => s.playerId === r.playerId && s.holeNumber === r.holeNumber
        );
        if (idx >= 0) {
          if (next === prev) next = [...prev];
          next[idx] = { ...next[idx], strokes: r.strokes };
        } else {
          if (next === prev) next = [...prev];
          next.push({
            ...blankScore(r.playerId, r.holeNumber),
            strokes: r.strokes,
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
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface-900/95 backdrop-blur border-b border-surface-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-surface-50 leading-tight">
              {round.courseName}
            </h1>
            <p className="text-xs text-surface-400">
              {new Date(round.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={() => router.push(`/rounds/${roundId}`)}
            className="text-xs text-surface-300 hover:text-surface-100 px-2 py-1"
          >
            Done
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
          />
        )}
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
