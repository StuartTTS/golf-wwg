'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { saveTeeTimeGroups, clearTeeTimeGroups } from '@/lib/actions/tee-time-groups';
import { useRouter } from 'next/navigation';

interface Player {
  id: string;
  displayName: string;
  isGuest?: boolean;
  courseHandicap: number | null;
  handicapIndex: number | null;
}

interface TeeTimeGroup {
  id: string;
  name: string;
  teeTime: string;
  playerIds: string[];
}

interface ExistingGroup {
  id: string;
  name: string;
  tee_time: string | null;
  sort_order: number;
}

interface TeeTimeGroupManagerProps {
  roundId: string;
  players: Player[];
  existingGroups: ExistingGroup[];
  playerGroupMap: Record<string, string>; // playerId -> groupId
}

function calculateGroupStats(playerIds: string[], allPlayers: Player[]) {
  const groupPlayers = playerIds
    .map(id => allPlayers.find(p => p.id === id))
    .filter((p): p is Player => p !== undefined);

  const withCourseHc = groupPlayers.filter(p => p.courseHandicap !== null);
  const withIndex = groupPlayers.filter(p => p.handicapIndex !== null);

  return {
    courseHcSum: withCourseHc.reduce((sum, p) => sum + p.courseHandicap!, 0),
    courseHcAvg: withCourseHc.length > 0
      ? withCourseHc.reduce((sum, p) => sum + p.courseHandicap!, 0) / withCourseHc.length
      : 0,
    indexSum: withIndex.reduce((sum, p) => sum + p.handicapIndex!, 0),
    indexAvg: withIndex.length > 0
      ? withIndex.reduce((sum, p) => sum + p.handicapIndex!, 0) / withIndex.length
      : 0,
    playerCount: groupPlayers.length,
  };
}

let nextGroupId = 1;
function tempId() {
  return `temp-${nextGroupId++}`;
}

export default function TeeTimeGroupManager({
  roundId,
  players,
  existingGroups,
  playerGroupMap,
}: TeeTimeGroupManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Initialize groups from existing data
  const [groups, setGroups] = useState<TeeTimeGroup[]>(() => {
    if (existingGroups.length === 0) return [];
    return existingGroups
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((eg) => ({
        id: eg.id,
        name: eg.name,
        teeTime: eg.tee_time ?? '',
        playerIds: Object.entries(playerGroupMap)
          .filter(([, gId]) => gId === eg.id)
          .map(([pId]) => pId),
      }));
  });

  // Players not assigned to any group
  const assignedPlayerIds = new Set(groups.flatMap((g) => g.playerIds));
  const ungrouped = players.filter((p) => !assignedPlayerIds.has(p.id));

  function addGroup() {
    setGroups((prev) => [
      ...prev,
      {
        id: tempId(),
        name: `Group ${prev.length + 1}`,
        teeTime: '',
        playerIds: [],
      },
    ]);
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  function updateGroupName(groupId: string, name: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name } : g))
    );
  }

  function updateGroupTeeTime(groupId: string, teeTime: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, teeTime } : g))
    );
  }

  function movePlayer(playerId: string, toGroupId: string | 'ungrouped') {
    setGroups((prev) => {
      // Remove player from all groups
      const updated = prev.map((g) => ({
        ...g,
        playerIds: g.playerIds.filter((id) => id !== playerId),
      }));
      // Add to target group if not "ungrouped"
      if (toGroupId !== 'ungrouped') {
        return updated.map((g) =>
          g.id === toGroupId
            ? { ...g, playerIds: [...g.playerIds, playerId] }
            : g
        );
      }
      return updated;
    });
  }

  // --- Desktop drag-and-drop ---
  function handleDragStart(playerId: string) {
    setDraggedPlayerId(playerId);
    setSelectedPlayerId(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(targetGroupId: string | 'ungrouped') {
    if (draggedPlayerId) {
      movePlayer(draggedPlayerId, targetGroupId);
      setDraggedPlayerId(null);
    }
  }

  // --- Mobile tap-to-select / tap-to-place ---
  function handlePlayerTap(playerId: string) {
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null); // deselect on second tap
    } else {
      setSelectedPlayerId(playerId);
    }
  }

  function handleZoneTap(targetGroupId: string | 'ungrouped') {
    if (selectedPlayerId) {
      movePlayer(selectedPlayerId, targetGroupId);
      setSelectedPlayerId(null);
    }
  }

  const isMoving = draggedPlayerId !== null || selectedPlayerId !== null;

  function handleSave() {
    const sizeWarnings = groups
      .filter(g => g.playerIds.length > 0 && (g.playerIds.length < 2 || g.playerIds.length > 5))
      .map(g => `${g.name}: ${g.playerIds.length} players`);

    if (sizeWarnings.length > 0) {
      const proceed = confirm(
        `Some groups have unusual sizes (recommended: 2-5 players):\n${sizeWarnings.join('\n')}\n\nSave anyway?`
      );
      if (!proceed) return;
    }

    startTransition(async () => {
      const result = await saveTeeTimeGroups(
        roundId,
        groups.map((g) => ({
          name: g.name,
          teeTime: g.teeTime || null,
          playerIds: g.playerIds,
        }))
      );
      if (result.error) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearTeeTimeGroups(roundId);
      if (result.error) {
        alert(result.error);
      } else {
        setGroups([]);
        router.refresh();
      }
    });
  }

  function getPlayerName(id: string) {
    return players.find((p) => p.id === id)?.displayName ?? 'Unknown';
  }

  function isGuest(id: string) {
    return players.find((p) => p.id === id)?.isGuest ?? false;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Tee Time Groups</CardTitle>
          <div className="flex gap-2">
            {groups.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isPending}
              >
                Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={addGroup}>
              + Add Group
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="px-4 pb-4 space-y-4">
        {/* Instruction hint */}
        {groups.length > 0 && (
          <p className="text-xs text-surface-400 text-center">
            Tap a player then tap a group to move them
          </p>
        )}

        {/* Ungrouped players pool */}
        <div
          className={`rounded-lg border-2 border-dashed p-3 transition-colors ${
            isMoving
              ? 'border-surface-400 bg-surface-700/50'
              : 'border-surface-600'
          }`}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop('ungrouped')}
          onClick={() => handleZoneTap('ungrouped')}
        >
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
            Ungrouped ({ungrouped.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {ungrouped.map((player) => (
              <PlayerChip
                key={player.id}
                name={player.displayName}
                isGuest={player.isGuest}
                courseHandicap={player.courseHandicap}
                selected={selectedPlayerId === player.id}
                onDragStart={() => handleDragStart(player.id)}
                onTap={() => handlePlayerTap(player.id)}
              />
            ))}
            {ungrouped.length === 0 && (
              <p className="text-xs text-surface-500 italic">
                All players assigned
              </p>
            )}
          </div>
        </div>

        {/* Groups */}
        {groups.map((group) => (
          <div
            key={group.id}
            className={`rounded-lg border p-3 transition-colors ${
              isMoving
                ? 'border-golf-600/50 bg-surface-700/30'
                : 'border-surface-600 bg-surface-800/50'
            }`}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(group.id)}
            onClick={() => handleZoneTap(group.id)}
          >
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={group.name}
                onChange={(e) => updateGroupName(group.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent text-sm font-semibold text-surface-100 border-none outline-none focus:underline w-28"
              />
              <input
                type="time"
                value={group.teeTime}
                onChange={(e) => updateGroupTeeTime(group.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="bg-surface-700 text-xs text-surface-200 rounded px-2 py-1 border border-surface-600"
                placeholder="Tee time"
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeGroup(group.id); }}
                className="ml-auto text-surface-500 hover:text-red-400 text-xs"
                title="Remove group"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[32px]">
              {group.playerIds.map((pid) => (
                <PlayerChip
                  key={pid}
                  name={getPlayerName(pid)}
                  isGuest={isGuest(pid)}
                  courseHandicap={players.find(p => p.id === pid)?.courseHandicap ?? null}
                  selected={selectedPlayerId === pid}
                  onDragStart={() => handleDragStart(pid)}
                  onTap={() => handlePlayerTap(pid)}
                />
              ))}
              {group.playerIds.length === 0 && (
                <p className="text-xs text-surface-500 italic">
                  Tap a player, then tap here to add
                </p>
              )}
            </div>
            {group.playerIds.length > 0 && (() => {
              const stats = calculateGroupStats(group.playerIds, players);
              return (
                <div className="border-t border-surface-700 pt-2 mt-2 text-xs text-surface-400 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Course HC:</span>
                    <span className="text-white">
                      Sum: {stats.courseHcSum} &bull; Avg: {stats.courseHcAvg.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>HC Index:</span>
                    <span className="text-surface-300">
                      Sum: {stats.indexSum.toFixed(1)} &bull; Avg: {stats.indexAvg.toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}

        {groups.length === 0 && (
          <p className="text-sm text-surface-400 text-center py-2">
            Add groups to split players into separate tee times
          </p>
        )}

        {/* Save button */}
        {groups.length > 0 && (
          <Button
            className="w-full"
            onClick={handleSave}
            loading={isPending}
            disabled={isPending}
          >
            Save Tee Time Groups
          </Button>
        )}
      </div>
    </Card>
  );
}

function PlayerChip({
  name,
  isGuest,
  courseHandicap,
  selected,
  onDragStart,
  onTap,
}: {
  name: string;
  isGuest?: boolean;
  courseHandicap: number | null;
  selected?: boolean;
  onDragStart: () => void;
  onTap: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm cursor-grab active:cursor-grabbing transition-colors select-none ${
        selected
          ? 'bg-golf-600 text-white ring-2 ring-golf-400 ring-offset-1 ring-offset-surface-800'
          : 'bg-surface-700 text-surface-100 hover:bg-surface-600'
      }`}
    >
      <span>{name}</span>
      <span className={`text-xs ${selected ? 'text-golf-200' : 'text-surface-400'}`}>
        CH: {courseHandicap ?? 'N/A'}
      </span>
      {isGuest && (
        <span className={`text-xs ${selected ? 'text-golf-200' : 'text-surface-400'}`}>(G)</span>
      )}
    </div>
  );
}
