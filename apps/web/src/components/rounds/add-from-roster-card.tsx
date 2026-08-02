'use client';

// Commish control on the round page: add existing roster players to the round
// (and every active game on it) — the counterpart to the ad-hoc Add Guest form.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addRosterPlayersToRound } from '@/lib/actions/rounds';
import { linkRosterPlayer } from '@/lib/actions/roster';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RosterEntry {
  id: string;
  display_name: string;
  handicap_index: number | null;
}

interface InRoundAccount {
  userId: string;
  displayName: string;
}

export function AddFromRosterCard({
  roundId,
  roster,
  inRoundAccounts,
}: {
  roundId: string;
  roster: RosterEntry[];
  inRoundAccounts: InRoundAccount[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkingId, setLinkingId] = useState<string | null>(null);
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

  function linkTo(rosterId: string, userId: string) {
    if (!userId) return;
    setError(null);
    startSave(async () => {
      const res = await linkRosterPlayer(rosterId, userId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setLinkingId(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add from roster</CardTitle>
        <CardDescription>
          Adds them to the round and every active game. If someone here already
          joined under their own account, use &ldquo;Already here?&rdquo; to link
          them instead of adding a duplicate.
        </CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 space-y-3">
        <div className="max-h-64 overflow-y-auto divide-y divide-surface-700/60 rounded-lg border border-surface-600">
          {roster.map((r) => (
            <div key={r.id} className="px-3 py-2 hover:bg-surface-700/40">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="w-4 h-4 accent-golf-600"
                  aria-label={`Add ${r.display_name}`}
                />
                <span className="flex-1 text-sm text-surface-100">{r.display_name}</span>
                <span className="text-xs text-surface-400">
                  HCP {r.handicap_index ?? '—'}
                </span>
                {inRoundAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLinkingId(linkingId === r.id ? null : r.id)}
                    disabled={saving}
                    className="text-[11px] text-surface-400 hover:text-golf-400 whitespace-nowrap"
                  >
                    Already here?
                  </button>
                )}
              </div>
              {linkingId === r.id && (
                <div className="mt-1.5 flex items-center gap-2 pl-7">
                  <span className="text-[11px] text-surface-400 shrink-0">This is:</span>
                  <select
                    defaultValue=""
                    disabled={saving}
                    onChange={(e) => linkTo(r.id, e.target.value)}
                    className="flex-1 min-w-0 bg-surface-700 text-xs text-surface-100 rounded-md border border-surface-600 px-2 py-1.5"
                  >
                    <option value="">Pick the player already in…</option>
                    {inRoundAccounts.map((a) => (
                      <option key={a.userId} value={a.userId}>
                        {a.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
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
