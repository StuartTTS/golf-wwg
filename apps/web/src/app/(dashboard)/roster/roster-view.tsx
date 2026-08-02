'use client';

// The player roster: your reusable list of people you play with. View / add /
// edit / remove, plus one-tap "add" of recent co-players. Backed by the roster
// server actions; keeps a local optimistic copy so it feels snappy.

import { useState } from 'react';
import {
  addRosterPlayer,
  updateRosterPlayer,
  removeRosterPlayer,
  type RosterEntry,
} from '@/lib/actions/roster';
import {
  createRosterGroup,
  renameRosterGroup,
  deleteRosterGroup,
  setRosterGroupMembers,
  type RosterGroup,
} from '@/lib/actions/roster-groups';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
} from '@/components/ui';
import {
  RosterPlayerFields,
  emptyRosterForm,
  rosterFormFrom,
  type RosterFormValue,
} from '@/components/roster/roster-player-fields';

interface Suggestion {
  userId: string;
  displayName: string;
  handicapIndex: number | null;
}

interface Props {
  initialRoster: RosterEntry[];
  suggestions: Suggestion[];
  initialGroups: RosterGroup[];
}

const byName = (a: RosterEntry, b: RosterEntry) =>
  a.displayName.localeCompare(b.displayName);

function parseHcp(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

export default function RosterView({
  initialRoster,
  suggestions: initial,
  initialGroups,
}: Props) {
  const [roster, setRoster] = useState<RosterEntry[]>([...initialRoster].sort(byName));
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initial);
  const [groups, setGroups] = useState<RosterGroup[]>(initialGroups);
  const [error, setError] = useState<string | null>(null);

  // ---- Groups ----
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (name.length < 1) return;
    setCreatingGroup(true);
    setError(null);
    const res = (await createRosterGroup(name)) as any;
    setCreatingGroup(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setGroups((g) =>
      [...g, { id: res.groupId, name, memberIds: [] }].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    setNewGroupName('');
  }

  async function handleRenameGroup(id: string, name: string) {
    const res = (await renameRosterGroup(id, name)) as any;
    if (res?.error) {
      setError(res.error);
      return false;
    }
    setGroups((g) =>
      g.map((x) => (x.id === id ? { ...x, name } : x)).sort((a, b) => a.name.localeCompare(b.name))
    );
    return true;
  }

  async function handleDeleteGroup(id: string) {
    const prev = groups;
    setGroups((g) => g.filter((x) => x.id !== id));
    const res = (await deleteRosterGroup(id)) as any;
    if (res?.error) {
      setError(res.error);
      setGroups(prev);
    }
  }

  async function handleSetMembers(id: string, memberIds: string[]) {
    const res = (await setRosterGroupMembers(id, memberIds)) as any;
    if (res?.error) {
      setError(res.error);
      return false;
    }
    setGroups((g) => g.map((x) => (x.id === id ? { ...x, memberIds } : x)));
    return true;
  }

  // Add form
  const [addForm, setAddForm] = useState<RosterFormValue>(emptyRosterForm());
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const displayName = addForm.name.trim();
    if (displayName.length < 2) {
      setError('Enter a name (at least 2 characters).');
      return;
    }
    setError(null);
    setAdding(true);
    const handicapIndex = parseHcp(addForm.hcp);
    const email = addForm.email.trim();
    const phone = addForm.phone.trim();
    const res = (await addRosterPlayer({
      displayName,
      email: email || undefined,
      phone: phone || undefined,
      handicapIndex,
    })) as any;
    setAdding(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setRoster((r) =>
      [
        ...r,
        {
          id: res.rosterPlayerId,
          displayName,
          email: email || null,
          phone: phone || null,
          linkedUserId: null,
          handicapIndex,
          notes: null,
        },
      ].sort(byName)
    );
    setAddForm(emptyRosterForm());
  }

  async function handleRemove(id: string) {
    const prev = roster;
    setRoster((r) => r.filter((x) => x.id !== id));
    const res = (await removeRosterPlayer(id)) as any;
    if (res?.error) {
      setError(res.error);
      setRoster(prev);
    }
  }

  async function handleSave(id: string, patch: Partial<RosterEntry>) {
    setError(null);
    const res = (await updateRosterPlayer(id, {
      displayName: patch.displayName,
      email: patch.email,
      phone: patch.phone,
      handicapIndex: patch.handicapIndex,
    })) as any;
    if (res?.error) {
      setError(res.error);
      return false;
    }
    setRoster((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort(byName));
    return true;
  }

  async function handleAddSuggestion(s: Suggestion) {
    setSuggestions((list) => list.filter((x) => x.userId !== s.userId));
    const res = (await addRosterPlayer({
      displayName: s.displayName,
      linkedUserId: s.userId,
      handicapIndex: s.handicapIndex,
    })) as any;
    if (res?.error) {
      setError(res.error);
      return;
    }
    setRoster((r) =>
      [
        ...r,
        {
          id: res.rosterPlayerId,
          displayName: s.displayName,
          email: null,
          phone: null,
          linkedUserId: s.userId,
          handicapIndex: s.handicapIndex,
          notes: null,
        },
      ].sort(byName)
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">My Roster</h1>
        <p className="mt-1 text-sm text-surface-300">
          The people you play with — add them once, then drop them into games in a tap.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/30 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* Add a player */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add a player</CardTitle>
          <CardDescription>
            Just a name works. Add a phone or email so they auto-link when they join.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-3">
          <RosterPlayerFields
            value={addForm}
            onChange={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
          />
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={adding || addForm.name.trim().length < 2}>
              {adding ? 'Adding…' : 'Add to roster'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Groups — personal folders over the roster */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Groups</CardTitle>
          <CardDescription>
            Organize your roster into folders (e.g. &quot;Sunday Crew&quot;) to pre-fill games.
            A player can be in more than one.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New group name"
              value={newGroupName}
              onChange={(e: any) => setNewGroupName(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter') handleCreateGroup();
              }}
            />
            <Button
              onClick={handleCreateGroup}
              disabled={creatingGroup || newGroupName.trim().length < 1}
            >
              {creatingGroup ? 'Adding…' : 'New group'}
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-surface-400">
              No groups yet. Create one, then add players to it.
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  roster={roster}
                  onRename={handleRenameGroup}
                  onDelete={handleDeleteGroup}
                  onSetMembers={handleSetMembers}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Recent players */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recently played with</CardTitle>
            <CardDescription>People from your past rounds not yet on your roster.</CardDescription>
          </CardHeader>
          <div className="px-6 pb-6 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.userId}
                onClick={() => handleAddSuggestion(s)}
                className="flex items-center gap-2 rounded-full border border-surface-500 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 hover:border-golf-500 hover:bg-golf-900/20 transition-colors"
              >
                <span className="font-medium">{s.displayName}</span>
                {s.handicapIndex != null && (
                  <span className="text-xs text-surface-400">{s.handicapIndex}</span>
                )}
                <span className="text-golf-400">+</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Roster list */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-surface-400">
          Players ({roster.length})
        </h2>
        {roster.length === 0 ? (
          <Card>
            <CardHeader className="text-center py-10">
              <CardDescription>
                Your roster is empty. Add someone above, or tap a recent player.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="space-y-2">
            {roster.map((entry) => (
              <RosterRow
                key={entry.id}
                entry={entry}
                onSave={handleSave}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RosterRow({
  entry,
  onSave,
  onRemove,
}: {
  entry: RosterEntry;
  onSave: (id: string, patch: Partial<RosterEntry>) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RosterFormValue>(rosterFormFrom(entry));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (form.name.trim().length < 2) return;
    setBusy(true);
    const ok = await onSave(entry.id, {
      displayName: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      handicapIndex: parseHcp(form.hcp),
    });
    setBusy(false);
    if (ok) setEditing(false);
  }

  function cancel() {
    setForm(rosterFormFrom(entry));
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-golf-500/40 bg-surface-800 p-4 space-y-3">
        <RosterPlayerFields
          value={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={busy || form.name.trim().length < 2}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </li>
    );
  }

  const meta = [
    entry.handicapIndex != null ? `Hcp ${entry.handicapIndex}` : null,
    entry.email,
    entry.phone,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-center gap-3 rounded-xl border border-surface-600 bg-surface-800 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-900/40 text-sm font-semibold text-golf-400">
        {entry.displayName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-surface-50">{entry.displayName}</span>
          {entry.linkedUserId && (
            <span className="rounded bg-golf-900/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-golf-400">
              On app
            </span>
          )}
        </div>
        {meta && <p className="truncate text-xs text-surface-400">{meta}</p>}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="px-2 py-1 text-xs text-surface-300 hover:text-surface-100"
      >
        Edit
      </button>
      <button
        onClick={() => onRemove(entry.id)}
        aria-label={`Remove ${entry.displayName}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 hover:bg-surface-700 hover:text-red-400"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}

function GroupCard({
  group,
  roster,
  onRename,
  onDelete,
  onSetMembers,
}: {
  group: RosterGroup;
  roster: RosterEntry[];
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  onSetMembers: (id: string, memberIds: string[]) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(group.memberIds));
  const [savingMembers, setSavingMembers] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [busyName, setBusyName] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveMembers() {
    setSavingMembers(true);
    const ok = await onSetMembers(group.id, [...selected]);
    setSavingMembers(false);
    if (ok) setOpen(false);
  }

  async function saveName() {
    if (name.trim().length < 1) return;
    setBusyName(true);
    const ok = await onRename(group.id, name.trim());
    setBusyName(false);
    if (ok) setRenaming(false);
  }

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800">
      <div className="flex items-center gap-2 p-3">
        {renaming ? (
          <>
            <Input value={name} onChange={(e: any) => setName(e.target.value)} />
            <Button size="sm" onClick={saveName} disabled={busyName || name.trim().length < 1}>
              {busyName ? '…' : 'Save'}
            </Button>
            <button
              onClick={() => {
                setName(group.name);
                setRenaming(false);
              }}
              className="px-2 text-xs text-surface-400 hover:text-surface-200"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-surface-50">{group.name}</p>
              <p className="text-xs text-surface-400">
                {group.memberIds.length} player{group.memberIds.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              onClick={() => {
                setSelected(new Set(group.memberIds));
                setOpen((o) => !o);
              }}
              className="px-2 py-1 text-xs font-medium text-golf-400 hover:text-golf-300"
            >
              {open ? 'Close' : 'Manage'}
            </button>
            <button
              onClick={() => setRenaming(true)}
              className="px-2 py-1 text-xs text-surface-300 hover:text-surface-100"
            >
              Rename
            </button>
            <button
              onClick={() => onDelete(group.id)}
              aria-label={`Delete ${group.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 hover:bg-surface-700 hover:text-red-400"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="border-t border-surface-700 p-3 space-y-3">
          {roster.length === 0 ? (
            <p className="text-sm text-surface-400">Add players to your roster first.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {roster.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-surface-700/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
                  />
                  <span className="truncate text-sm text-surface-100">{p.displayName}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveMembers} disabled={savingMembers}>
              {savingMembers ? 'Saving…' : `Save (${selected.size})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
