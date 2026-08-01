'use client';

// One card to set the whole lineup: each player listed ONCE with an inline tee
// picker and an inline group picker (replacing the separate Tee Assignments +
// Tee Time Groups cards, which listed everyone twice and needed tap-and-scroll).
// "Auto-split into foursomes" builds the groups in one tap. Saves tees + groups
// together.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updatePlayerTee, bulkUpdatePlayerTees } from '@/lib/actions/tee-assignments';
import { saveTeeTimeGroups } from '@/lib/actions/tee-time-groups';

interface TeeBox {
  id: string;
  name: string;
  course_rating: number;
  slope_rating: number;
  tier: number | null;
}
export interface LineupPlayer {
  roundPlayerId: string; // tee updates key on this
  playerId: string;      // group placement key (user_id for members, rp.id for guests)
  displayName: string;
  isGuest: boolean;
  teeBoxId: string;
  groupId: string | null;
  courseHandicap: number | null;
}
interface ExistingGroup {
  id: string;
  name: string;
  sort_order: number;
}
interface Props {
  roundId: string;
  roundStatus: string;
  teeBoxes: TeeBox[];
  defaultTeeBoxId: string;
  players: LineupPlayer[];
  existingGroups: ExistingGroup[];
}

const UNGROUPED = '';

export default function RoundLineupCard({
  roundId,
  roundStatus,
  teeBoxes,
  defaultTeeBoxId,
  players,
  existingGroups,
}: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const readOnly = roundStatus === 'completed';

  // Tee per player (roundPlayerId → teeBoxId)
  const [tees, setTees] = useState<Record<string, string>>(() =>
    Object.fromEntries(players.map((p) => [p.roundPlayerId, p.teeBoxId]))
  );
  // Group key per player (playerId → group key). '' = ungrouped.
  const [assign, setAssign] = useState<Record<string, string>>(() =>
    Object.fromEntries(players.map((p) => [p.playerId, p.groupId ?? UNGROUPED]))
  );
  // Groups: keyed by their current id (existing) or a temp key (new).
  const [groups, setGroups] = useState<{ key: string; name: string }[]>(() =>
    [...existingGroups]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({ key: g.id, name: g.name }))
  );
  const [groupSize, setGroupSize] = useState(4);
  const [tempSeq, setTempSeq] = useState(1);
  const [defaultTee, setDefaultTee] = useState(defaultTeeBoxId);
  const [error, setError] = useState<string | null>(null);

  const teeLabel = (t: TeeBox) => `${t.name} (${t.course_rating}/${t.slope_rating})`;

  function applyTeeToAll() {
    setTees(Object.fromEntries(players.map((p) => [p.roundPlayerId, defaultTee])));
  }

  function autoSplit() {
    const n = players.length;
    const count = Math.max(1, Math.ceil(n / groupSize));
    const newGroups = Array.from({ length: count }, (_, i) => ({
      key: `temp-${tempSeq + i}`,
      name: `Group ${i + 1}`,
    }));
    setTempSeq((s) => s + count);
    const next: Record<string, string> = {};
    players.forEach((p, i) => {
      next[p.playerId] = newGroups[Math.floor(i / groupSize)].key;
    });
    setGroups(newGroups);
    setAssign(next);
  }

  function addGroup() {
    const key = `temp-${tempSeq}`;
    setTempSeq((s) => s + 1);
    setGroups((g) => [...g, { key, name: `Group ${g.length + 1}` }]);
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of players) {
      const k = assign[p.playerId] ?? UNGROUPED;
      if (k) m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [assign, players]);

  function save() {
    setError(null);
    startSave(async () => {
      // 1) Tees — only the changed ones. Bulk when every player shares one tee.
      const changed = players.filter((p) => tees[p.roundPlayerId] !== p.teeBoxId);
      if (changed.length > 0) {
        const allTee = new Set(players.map((p) => tees[p.roundPlayerId]));
        if (allTee.size === 1) {
          const res = await bulkUpdatePlayerTees(roundId, [...allTee][0]);
          if (res.error) return setError(res.error);
        } else {
          for (const p of changed) {
            const res = await updatePlayerTee(roundId, p.roundPlayerId, tees[p.roundPlayerId]);
            if (res.error) return setError(`${p.displayName}: ${res.error}`);
          }
        }
      }

      // 2) Groups — rebuild from the assignments (only groups that have players).
      const payload = groups
        .map((g) => ({
          name: g.name,
          teeTime: null as string | null,
          playerIds: players.filter((p) => assign[p.playerId] === g.key).map((p) => p.playerId),
        }))
        .filter((g) => g.playerIds.length > 0);
      const res = await saveTeeTimeGroups(roundId, payload);
      if (res.error) return setError(res.error);

      router.refresh();
    });
  }

  return (
    <Card padding="none">
      <CardHeader className="px-4 pt-4 pb-0 mb-0">
        <CardTitle className="text-lg">Lineup</CardTitle>
        <p className="text-xs text-surface-400 mt-0.5">
          Set each player&apos;s tee and foursome, or auto-split.
        </p>
      </CardHeader>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {readOnly ? (
          <p className="text-xs text-surface-400">Round complete — lineup is locked.</p>
        ) : (
          <>
            {/* Quick actions */}
            <div className="rounded-lg border border-surface-600 bg-surface-800/50 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-surface-400 w-20 shrink-0">
                  Default tee
                </span>
                <select
                  value={defaultTee}
                  onChange={(e) => setDefaultTee(e.target.value)}
                  className="flex-1 min-w-0 bg-surface-700 text-sm text-surface-100 rounded-md border border-surface-600 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-golf-500"
                >
                  {teeBoxes.map((t) => (
                    <option key={t.id} value={t.id}>{teeLabel(t)}</option>
                  ))}
                </select>
                <Button variant="secondary" size="sm" onClick={applyTeeToAll}>All</Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-surface-400 w-20 shrink-0">
                  Foursomes
                </span>
                <span className="text-xs text-surface-300">Groups of</span>
                <select
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                  className="bg-surface-700 text-sm text-surface-100 rounded-md border border-surface-600 px-2 py-1.5"
                >
                  {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <Button size="sm" onClick={autoSplit} className="ml-auto">Auto-split</Button>
              </div>
            </div>

            {/* Player rows */}
            <ul className="divide-y divide-surface-700/60">
              {players.map((p) => (
                <li key={p.roundPlayerId} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-surface-100 truncate">
                      {p.displayName}
                      {p.isGuest && <span className="ml-1 text-xs text-surface-400">(G)</span>}
                    </span>
                    <span className="text-xs text-surface-400 shrink-0">
                      CH {p.courseHandicap ?? '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <select
                      aria-label={`Tee for ${p.displayName}`}
                      value={tees[p.roundPlayerId] ?? defaultTeeBoxId}
                      onChange={(e) => setTees((t) => ({ ...t, [p.roundPlayerId]: e.target.value }))}
                      className="min-w-0 bg-surface-700 text-sm text-surface-100 rounded-md border border-surface-600 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-golf-500"
                    >
                      {teeBoxes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label={`Group for ${p.displayName}`}
                      value={assign[p.playerId] ?? UNGROUPED}
                      onChange={(e) => setAssign((a) => ({ ...a, [p.playerId]: e.target.value }))}
                      className="min-w-0 bg-surface-700 text-sm text-surface-100 rounded-md border border-surface-600 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-golf-500"
                    >
                      <option value={UNGROUPED}>No group</option>
                      {groups.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.name}{counts[g.key] ? ` (${counts[g.key]})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={addGroup} className="text-surface-300 hover:text-surface-100">
                + Add group
              </Button>
              <Button className="ml-auto" size="sm" onClick={save} loading={saving} disabled={saving}>
                Save lineup
              </Button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </>
        )}
      </div>
    </Card>
  );
}
