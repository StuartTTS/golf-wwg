'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { updatePlayerTee, bulkUpdatePlayerTees } from '@/lib/actions/tee-assignments';

interface TeeBox {
  id: string;
  name: string;
  color: string | null;
  course_rating: number;
  slope_rating: number;
  tier: number | null;
}

interface PlayerTee {
  roundPlayerId: string;
  displayName: string;
  teeBoxId: string;
  isGuest: boolean;
  defaultTeeTier: number | null;
}

interface TeeAssignmentCardProps {
  roundId: string;
  roundStatus: string;
  defaultTeeBoxId: string;
  teeBoxes: TeeBox[];
  players: PlayerTee[];
}

function findClosestTeeByTier(teeBoxes: TeeBox[], tier: number, fallbackId: string): string {
  const tiered = teeBoxes.filter((t) => t.tier !== null);
  if (tiered.length === 0) return fallbackId;
  let best = tiered[0];
  let bestDiff = Math.abs((best.tier ?? 0) - tier);
  for (const t of tiered) {
    const diff = Math.abs((t.tier ?? 0) - tier);
    if (diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return best.id;
}

export default function TeeAssignmentCard({
  roundId,
  roundStatus,
  defaultTeeBoxId,
  teeBoxes,
  players,
}: TeeAssignmentCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Local state: map of roundPlayerId -> teeBoxId
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of players) {
      init[p.roundPlayerId] = p.teeBoxId;
    }
    return init;
  });

  // The "default" tee selected in the bulk selector
  const [selectedDefaultTee, setSelectedDefaultTee] = useState(defaultTeeBoxId);

  const isReadOnly = roundStatus === 'completed';

  function handleApplyToAll() {
    setAssignments((prev) => {
      const updated = { ...prev };
      for (const p of players) {
        updated[p.roundPlayerId] = selectedDefaultTee;
      }
      return updated;
    });
  }

  function handleResetToPreferred() {
    setAssignments((prev) => {
      const updated = { ...prev };
      for (const p of players) {
        if (p.isGuest || p.defaultTeeTier === null) {
          updated[p.roundPlayerId] = defaultTeeBoxId;
        } else {
          updated[p.roundPlayerId] = findClosestTeeByTier(teeBoxes, p.defaultTeeTier, defaultTeeBoxId);
        }
      }
      return updated;
    });
  }

  function handlePlayerTeeChange(roundPlayerId: string, teeBoxId: string) {
    setAssignments((prev) => ({ ...prev, [roundPlayerId]: teeBoxId }));
  }

  function handleSave() {
    startTransition(async () => {
      // Check if all players have the same tee
      const allTeeIds = players.map((p) => assignments[p.roundPlayerId]);
      const firstTee = allTeeIds[0];
      const allSame = allTeeIds.every((id) => id === firstTee);

      if (allSame && firstTee) {
        const result = await bulkUpdatePlayerTees(roundId, firstTee);
        if (result.error) {
          alert(result.error);
          return;
        }
      } else {
        // Find changed players (compare to original)
        const changedPlayers = players.filter(
          (p) => assignments[p.roundPlayerId] !== p.teeBoxId
        );
        for (const p of changedPlayers) {
          const result = await updatePlayerTee(roundId, p.roundPlayerId, assignments[p.roundPlayerId]);
          if (result.error) {
            alert(`Failed to update ${p.displayName}: ${result.error}`);
            return;
          }
        }
      }

      router.refresh();
    });
  }

  function getTeeLabel(teeBoxId: string): string {
    const tee = teeBoxes.find((t) => t.id === teeBoxId);
    if (!tee) return 'Unknown';
    return `${tee.name} (${tee.course_rating} / ${tee.slope_rating})`;
  }

  return (
    <Card padding="none">
      <CardHeader className="px-4 pt-4 pb-0 mb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Tee Assignments</CardTitle>
          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            className="text-surface-400 hover:text-surface-200 transition-colors p-1"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <div className="px-4 pb-4 pt-3 space-y-4">
          {isReadOnly ? (
            /* Read-only view */
            <div className="space-y-2">
              {players.map((p) => {
                const tee = teeBoxes.find((t) => t.id === assignments[p.roundPlayerId]);
                return (
                  <div
                    key={p.roundPlayerId}
                    className="flex items-center justify-between py-2 border-b border-surface-700 last:border-0"
                  >
                    <span className="text-sm text-surface-100">
                      {p.displayName}
                      {p.isGuest && (
                        <span className="ml-1 text-xs text-surface-400">(G)</span>
                      )}
                    </span>
                    <span className="text-sm text-surface-300">
                      {tee ? (
                        <>
                          {tee.color && (
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                              style={{ backgroundColor: tee.color }}
                            />
                          )}
                          {tee.name}
                        </>
                      ) : (
                        'Not set'
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Edit view */
            <>
              {/* Bulk default tee selector */}
              <div className="rounded-lg border border-surface-600 bg-surface-800/50 p-3 space-y-2">
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                  Default Tee
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDefaultTee}
                    onChange={(e) => setSelectedDefaultTee(e.target.value)}
                    className="flex-1 bg-surface-700 text-sm text-surface-100 rounded-md border border-surface-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-golf-500"
                  >
                    {teeBoxes.map((tee) => (
                      <option key={tee.id} value={tee.id}>
                        {tee.name} ({tee.course_rating} / {tee.slope_rating})
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyToAll}
                    disabled={isPending}
                  >
                    Apply to All
                  </Button>
                </div>
              </div>

              {/* Per-player rows */}
              <div className="space-y-2">
                {players.map((p) => (
                  <div
                    key={p.roundPlayerId}
                    className="flex items-center gap-3 py-1.5"
                  >
                    <span className="text-sm text-surface-100 w-32 shrink-0 truncate">
                      {p.displayName}
                      {p.isGuest && (
                        <span className="ml-1 text-xs text-surface-400">(G)</span>
                      )}
                    </span>
                    <select
                      value={assignments[p.roundPlayerId] ?? defaultTeeBoxId}
                      onChange={(e) => handlePlayerTeeChange(p.roundPlayerId, e.target.value)}
                      className="flex-1 bg-surface-700 text-sm text-surface-100 rounded-md border border-surface-600 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-golf-500"
                    >
                      {teeBoxes.map((tee) => (
                        <option key={tee.id} value={tee.id}>
                          {tee.name} ({tee.course_rating} / {tee.slope_rating})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToPreferred}
                  disabled={isPending}
                  className="text-surface-400 hover:text-surface-200"
                >
                  Reset to Preferred
                </Button>
                <Button
                  className="ml-auto"
                  size="sm"
                  onClick={handleSave}
                  loading={isPending}
                  disabled={isPending}
                >
                  Save Tees
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
