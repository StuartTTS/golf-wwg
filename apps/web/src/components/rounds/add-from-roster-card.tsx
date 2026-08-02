'use client';

// Commish control on the round page: add existing roster players to the round
// (and every active game on it) — the counterpart to the ad-hoc Add Guest form.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addRosterPlayersToRound } from '@/lib/actions/rounds';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RosterEntry {
  id: string;
  display_name: string;
  handicap_index: number | null;
}

export function AddFromRosterCard({
  roundId,
  roster,
}: {
  roundId: string;
  roster: RosterEntry[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (roster.length === 0) return null; // everyone's already in the round

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    if (selected.size === 0) return;
    setError(null);
    startSave(async () => {
      const res = await addRosterPlayersToRound(roundId, [...selected]);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add from roster</CardTitle>
        <CardDescription>Adds them to the round and every active game.</CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 space-y-3">
        <div className="max-h-64 overflow-y-auto divide-y divide-surface-700/60 rounded-lg border border-surface-600">
          {roster.map((r) => (
            <label
              key={r.id}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-700/40"
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                className="w-4 h-4 accent-golf-600"
              />
              <span className="flex-1 text-sm text-surface-100">{r.display_name}</span>
              <span className="text-xs text-surface-400">
                HCP {r.handicap_index ?? '—'}
              </span>
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button
          className="w-full"
          size="sm"
          onClick={add}
          loading={saving}
          disabled={saving || selected.size === 0}
        >
          {selected.size > 0
            ? `Add ${selected.size} to round & games`
            : 'Select players to add'}
        </Button>
      </div>
    </Card>
  );
}
