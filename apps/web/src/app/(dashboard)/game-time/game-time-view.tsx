'use client';

// "Game Time" setup: pick a course, then pick the players (from a Group or the
// full Roster, plus add-new), then create the game round and hand off to the
// round page for games / foursomes / tees / Share. Presentational; logic lives
// in server actions. See docs/groups-as-roster-folders.md.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createGameTimeRound } from '@/lib/actions/rounds';
import { addRosterPlayer, type RosterEntry } from '@/lib/actions/roster';
import { type RosterGroup } from '@/lib/actions/roster-groups';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  SimpleSelect,
} from '@/components/ui';

interface CourseLite {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}
interface TeeBox {
  id: string;
  name: string;
  tier: number | null;
  slope_rating: number;
  course_rating: number;
  course_id: string;
}
interface Props {
  recentCourses: CourseLite[];
  courses: CourseLite[];
  teeBoxes: TeeBox[];
  defaultTeeTier: number | null;
  initialRoster: RosterEntry[];
  groups: RosterGroup[];
}

function pickPreferredTee(tees: TeeBox[], tier: number | null): string {
  if (tees.length === 0) return '';
  if (tier == null) return tees[0].id;
  const withTier = tees.filter((t) => t.tier != null);
  if (withTier.length === 0) return tees[0].id;
  const exact = withTier.find((t) => t.tier === tier);
  if (exact) return exact.id;
  return withTier.reduce((prev, curr) =>
    Math.abs((curr.tier ?? 0) - tier) < Math.abs((prev.tier ?? 0) - tier) ? curr : prev
  ).id;
}

export default function GameTimeView({
  recentCourses,
  courses,
  teeBoxes,
  defaultTeeTier,
  initialRoster,
  groups,
}: Props) {
  const router = useRouter();

  const [step, setStep] = useState<'course' | 'players'>('course');
  const [courseId, setCourseId] = useState('');
  const [teeBoxId, setTeeBoxId] = useState('');

  const [roster, setRoster] = useState<RosterEntry[]>(initialRoster);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<string>('roster'); // 'roster' | group id

  const [newName, setNewName] = useState('');
  const [newHcp, setNewHcp] = useState('');
  const [addingNew, setAddingNew] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) ?? recentCourses.find((c) => c.id === courseId),
    [courses, recentCourses, courseId]
  );
  const cityState = (c: CourseLite) => [c.city, c.state].filter(Boolean).join(', ');

  function chooseCourse(id: string) {
    setError(null);
    setCourseId(id);
    setTeeBoxId(pickPreferredTee(teeBoxes.filter((t) => t.course_id === id), defaultTeeTier));
    setStep('players');
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSourceChange(value: string) {
    setSource(value);
    if (value !== 'roster') {
      const g = groups.find((x) => x.id === value);
      if (g) setSelected(new Set(g.memberIds));
    }
  }

  async function handleAddNew() {
    const name = newName.trim();
    if (name.length < 2) return;
    setAddingNew(true);
    setError(null);
    const hcp = newHcp.trim() === '' ? null : Number(newHcp);
    const res = (await addRosterPlayer({
      displayName: name,
      handicapIndex: Number.isNaN(hcp as number) ? null : hcp,
    })) as any;
    setAddingNew(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    const entry: RosterEntry = {
      id: res.rosterPlayerId,
      displayName: name,
      email: null,
      phone: null,
      linkedUserId: null,
      handicapIndex: Number.isNaN(hcp as number) ? null : hcp,
      notes: null,
    };
    setRoster((r) => [...r, entry].sort((a, b) => a.displayName.localeCompare(b.displayName)));
    setSelected((s) => new Set(s).add(entry.id));
    setNewName('');
    setNewHcp('');
  }

  async function handleCreate() {
    if (!courseId || !teeBoxId) {
      setError('Pick a course first.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = (await createGameTimeRound({
      courseId,
      teeBoxId,
      rosterPlayerIds: [...selected],
    })) as any;
    if (res?.error && !res.roundId) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    router.push(`/rounds/${res.roundId}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">Game Time</h1>
        <p className="mt-1 text-sm text-surface-300">
          Set up a game with friends — pick a course and your players, then add games and share a code.
        </p>
      </div>

      {error && <div className="rounded-md bg-red-900/30 p-4 text-sm text-red-400">{error}</div>}

      {/* Step 1: Course */}
      {step === 'course' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Choose a course</CardTitle>
            <CardDescription>Your recent courses are ready to go.</CardDescription>
          </CardHeader>
          <div className="px-6 pb-6 space-y-5">
            {recentCourses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-300">
                  Recently played
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recentCourses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => chooseCourse(c.id)}
                      className="text-left p-3 rounded-lg border-2 border-surface-500 hover:border-golf-500 hover:bg-golf-900/20 transition-colors"
                    >
                      <p className="text-sm font-medium text-surface-50 truncate">{c.name}</p>
                      {cityState(c) && <p className="text-xs text-surface-300 truncate">{cityState(c)}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-surface-100">
                {recentCourses.length > 0 ? 'Or pick another course' : 'Pick a course'}
              </label>
              {courses.length === 0 ? (
                <p className="text-sm text-surface-300">
                  No courses yet.{' '}
                  <Link href="/courses/new" className="text-golf-400 hover:underline">
                    Add one
                  </Link>
                  .
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <SimpleSelect
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                      options={courses.map((c) => ({
                        value: c.id,
                        label: cityState(c) ? `${c.name} — ${cityState(c)}` : c.name,
                      }))}
                      placeholder="Choose a course..."
                    />
                  </div>
                  <Button type="button" onClick={() => courseId && chooseCourse(courseId)} disabled={!courseId}>
                    Next
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Players */}
      {step === 'players' && (
        <Card className="max-w-2xl">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Who's playing?</CardTitle>
              <CardDescription>
                {selectedCourse?.name}
                {selectedCourse && cityState(selectedCourse) ? ` — ${cityState(selectedCourse)}` : ''}
              </CardDescription>
            </div>
            <button
              type="button"
              onClick={() => setStep('course')}
              className="text-xs text-surface-300 hover:text-surface-100 shrink-0"
            >
              Change course
            </button>
          </CardHeader>
          <div className="px-6 pb-6 space-y-4">
            {/* Fill from a group */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-surface-200 shrink-0">Fill from</label>
              <SimpleSelect
                value={source}
                onChange={(e) => onSourceChange(e.target.value)}
                options={[
                  { value: 'roster', label: 'Full roster' },
                  ...groups.map((g) => ({ value: g.id, label: `${g.name} (${g.memberIds.length})` })),
                ]}
              />
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set(roster.map((r) => r.id)))}>
                  All
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  None
                </Button>
              </div>
            </div>

            {/* Player checklist */}
            {roster.length === 0 ? (
              <p className="text-sm text-surface-300">
                Your roster is empty.{' '}
                <Link href="/roster" className="text-golf-400 hover:underline">
                  Add players
                </Link>{' '}
                or add someone below.
              </p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {roster.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-surface-700/50">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
                      />
                      <span className="truncate text-sm text-surface-100">{p.displayName}</span>
                      {p.handicapIndex != null && (
                        <span className="ml-auto text-xs text-surface-400">{p.handicapIndex}</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}

            {/* Add someone new */}
            <div className="flex gap-2 border-t border-surface-700 pt-3">
              <Input
                placeholder="Add someone new"
                value={newName}
                onChange={(e: any) => setNewName(e.target.value)}
                onKeyDown={(e: any) => {
                  if (e.key === 'Enter') handleAddNew();
                }}
              />
              <Input
                placeholder="Hcp"
                inputMode="decimal"
                value={newHcp}
                onChange={(e: any) => setNewHcp(e.target.value)}
                className="w-20"
              />
              <Button type="button" variant="outline" onClick={handleAddNew} disabled={addingNew || newName.trim().length < 2}>
                {addingNew ? '…' : 'Add'}
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-surface-600">
              <span className="text-sm text-surface-300">
                {selected.size + 1} playing <span className="text-surface-500">(you + {selected.size})</span>
              </span>
              <Button type="button" onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Creating…' : 'Create game'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
