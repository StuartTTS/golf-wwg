'use client';

import { useState } from 'react';
import type { HoleInfo, PlayerInfo, HoleScore } from '@golf/core';
import { Button } from '@/components/ui';

interface HoleEntryProps {
  hole: HoleInfo;
  players: PlayerInfo[];
  scores: HoleScore[];
  onScoreChange: (playerId: string, holeNumber: number, strokes: number | null) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Mobile-optimized single-hole score entry view.
 * Shows one hole at a time with large touch targets.
 */
export function HoleEntry({
  hole,
  players,
  scores,
  onScoreChange,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: HoleEntryProps) {
  const [expandedStats, setExpandedStats] = useState<string | null>(null);

  const getScore = (playerId: string) =>
    scores.find((s) => s.playerId === playerId && s.holeNumber === hole.holeNumber);

  const quickScores = [
    hole.par - 2,
    hole.par - 1,
    hole.par,
    hole.par + 1,
    hole.par + 2,
    hole.par + 3,
  ].filter((s) => s >= 1);

  const scoreLabel = (strokes: number) => {
    const diff = strokes - hole.par;
    if (diff <= -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Dbl';
    return `+${diff}`;
  };

  const scoreButtonColor = (strokes: number, isActive: boolean) => {
    if (!isActive) {
      const diff = strokes - hole.par;
      if (diff <= -2) return 'border-yellow-400 hover:bg-yellow-50';
      if (diff === -1) return 'border-red-300 hover:bg-red-50';
      if (diff === 0) return 'border-slate-300 hover:bg-slate-50';
      if (diff === 1) return 'border-blue-300 hover:bg-blue-50';
      return 'border-blue-400 hover:bg-blue-50';
    }
    const diff = strokes - hole.par;
    if (diff <= -2) return 'bg-yellow-200 border-yellow-400';
    if (diff === -1) return 'bg-red-100 border-red-400';
    if (diff === 0) return 'bg-slate-200 border-slate-400';
    if (diff === 1) return 'bg-blue-100 border-blue-400';
    return 'bg-blue-200 border-blue-400';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Hole Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-golf-600 text-white">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-3 py-1 rounded-md disabled:opacity-30"
        >
          &#9664; Prev
        </button>
        <div className="text-center">
          <div className="text-2xl font-bold">Hole {hole.holeNumber}</div>
          <div className="text-sm opacity-90">
            Par {hole.par} {hole.yardage ? `• ${hole.yardage} yds` : ''}
            {' • Hdcp '}{hole.handicapIndex}
          </div>
        </div>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="px-3 py-1 rounded-md disabled:opacity-30"
        >
          Next &#9654;
        </button>
      </div>

      {/* Player Score Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {players.map((player) => {
          const score = getScore(player.playerId);
          const isExpanded = expandedStats === player.playerId;

          return (
            <div
              key={player.playerId}
              className="bg-white rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-medium text-slate-900">
                    {player.displayName}
                  </div>
                  {player.playingHandicap > 0 && (
                    <div className="text-xs text-slate-500">
                      Hdcp {player.playingHandicap}
                    </div>
                  )}
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {score?.strokes ?? '-'}
                </div>
              </div>

              {/* Quick Score Buttons */}
              <div className="flex gap-2 flex-wrap">
                {quickScores.map((s) => (
                  <button
                    key={s}
                    onClick={() => onScoreChange(player.playerId, hole.holeNumber, s)}
                    className={`flex-1 min-w-[48px] py-2.5 rounded-md border-2 text-center transition-colors ${scoreButtonColor(
                      s,
                      score?.strokes === s
                    )}`}
                  >
                    <div className="text-lg font-bold">{s}</div>
                    <div className="text-[10px] text-slate-500">
                      {scoreLabel(s)}
                    </div>
                  </button>
                ))}
              </div>

              {/* Toggle stats */}
              <button
                onClick={() =>
                  setExpandedStats(isExpanded ? null : player.playerId)
                }
                className="mt-2 text-xs text-slate-400 hover:text-slate-600"
              >
                {isExpanded ? 'Hide stats' : 'Add stats'}
              </button>

              {isExpanded && (
                <div className="mt-2 flex gap-4 text-xs">
                  <label className="flex items-center gap-1">
                    <span className="text-slate-500">Putts:</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      className="w-12 rounded border border-slate-200 px-1 py-0.5 text-center"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" className="rounded" />
                    <span className="text-slate-500">FIR</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" className="rounded" />
                    <span className="text-slate-500">GIR</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
