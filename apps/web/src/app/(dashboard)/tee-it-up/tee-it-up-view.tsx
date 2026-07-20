'use client';

// Presentational view for the "Tee It Up Now" solo flow. Kept deliberately thin
// and presentational — all data/logic lives in the server page + server actions,
// so this layer can be restyled (e.g. from hand-drawn sketches) without touching
// behavior. See docs/phase1-type-a-spec.md.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSoloRound } from '@/lib/actions/rounds';
import { useSupabase } from '@/providers/supabase-provider';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
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
  color: string | null;
  tier: number | null;
  slope_rating: number;
  course_rating: number;
  course_id: string;
}

interface Props {
  userId: string;
  recentCourses: CourseLite[];
  courses: CourseLite[];
  teeBoxes: TeeBox[];
  defaultTeeTier: number | null;
}

// Closest-tier match, mirroring acceptRoundInvite's tee assignment.
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

export default function TeeItUpView({
  userId,
  recentCourses,
  courses,
  teeBoxes,
  defaultTeeTier,
}: Props) {
  const router = useRouter();
  const { supabase } = useSupabase();

  const [step, setStep] = useState<'course' | 'tees'>('course');
  const [courseId, setCourseId] = useState('');
  const [teeBoxId, setTeeBoxId] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courseTees = useMemo(
    () => teeBoxes.filter((t) => t.course_id === courseId),
    [teeBoxes, courseId]
  );
  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) ?? recentCourses.find((c) => c.id === courseId),
    [courses, recentCourses, courseId]
  );

  function chooseCourse(id: string) {
    setError(null);
    setCourseId(id);
    const tees = teeBoxes.filter((t) => t.course_id === id);
    setTeeBoxId(pickPreferredTee(tees, defaultTeeTier));
    setStep('tees');
  }

  async function handleStart() {
    if (!courseId || !teeBoxId) return;
    setError(null);
    setSubmitting(true);
    try {
      // Optionally remember this tee's tier as the user's preferred default.
      if (setAsDefault && supabase) {
        const tier = courseTees.find((t) => t.id === teeBoxId)?.tier ?? null;
        if (tier != null) {
          await supabase.from('profiles').update({ default_tee_tier: tier }).eq('id', userId);
        }
      }

      const result = (await createSoloRound({ courseId, teeBoxId })) as any;
      if (result?.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      router.push(`/rounds/${result.roundId}/play?tab=enter`);
    } catch {
      setError('Something went wrong starting your round. Please try again.');
      setSubmitting(false);
    }
  }

  const cityState = (c: CourseLite) =>
    [c.city, c.state].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">Tee It Up Now</h1>
        <p className="mt-1 text-sm text-surface-300">
          Pick your course, confirm your tees, and start tracking your round.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/30 p-4 text-sm text-red-400">{error}</div>
      )}

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
                      {cityState(c) && (
                        <p className="text-xs text-surface-300 truncate">{cityState(c)}</p>
                      )}
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
                  </Link>{' '}
                  to get started.
                </p>
              ) : (
                <>
                  <SimpleSelect
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    options={courses.map((c) => ({
                      value: c.id,
                      label: cityState(c) ? `${c.name} — ${cityState(c)}` : c.name,
                    }))}
                    placeholder="Choose a course..."
                  />
                  <div className="flex items-center justify-between pt-1">
                    <Link href="/courses/new" className="text-xs text-golf-400 hover:underline">
                      Course not listed? Add it
                    </Link>
                    <Button
                      type="button"
                      onClick={() => courseId && chooseCourse(courseId)}
                      disabled={!courseId}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Tees */}
      {step === 'tees' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Confirm your tees</CardTitle>
            <CardDescription>
              {selectedCourse?.name}
              {selectedCourse && cityState(selectedCourse) ? ` — ${cityState(selectedCourse)}` : ''}
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6 space-y-4">
            {courseTees.length === 0 ? (
              <p className="text-sm text-surface-300">
                This course has no tee boxes yet.{' '}
                <Link href={`/courses/${courseId}`} className="text-golf-400 hover:underline">
                  Add tees
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-surface-100">Tees</label>
                  <SimpleSelect
                    value={teeBoxId}
                    onChange={(e) => setTeeBoxId(e.target.value)}
                    options={courseTees.map((t) => ({
                      value: t.id,
                      label: `${t.name} · ${t.course_rating}/${t.slope_rating}`,
                    }))}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-surface-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setAsDefault}
                    onChange={(e) => setSetAsDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
                  />
                  Set as my default tees
                </label>
              </>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-surface-600">
              <Button type="button" variant="outline" onClick={() => setStep('course')}>
                Back
              </Button>
              <Button
                type="button"
                onClick={handleStart}
                disabled={!teeBoxId || submitting}
              >
                {submitting ? 'Starting…' : 'Start Round'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
