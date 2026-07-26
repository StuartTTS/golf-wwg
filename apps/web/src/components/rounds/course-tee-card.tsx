'use client';

// Change the round's course + default tee — available to the Commish even after
// the round has started (a fix for "I picked the wrong course"). Changing the
// course moves everyone to the new course's default tee and re-rates handicaps;
// per-player tee tuning stays in the Tee Assignments card below.
// See docs/round-course-tee-editing.md.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateRoundCourse } from '@/lib/actions/rounds';
import { getCourseTeeBoxes, type CourseTeeBox } from '@/lib/actions/courses';

interface CourseLite {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}
interface Props {
  roundId: string;
  roundStatus: string;
  currentCourseId: string;
  currentCourseName: string;
  currentTeeName: string | null;
  courses: CourseLite[];
  hasScores: boolean;
}

function preferredTee(tees: CourseTeeBox[]): string {
  if (tees.length === 0) return '';
  const tiered = tees.filter((t) => t.tier != null);
  return (tiered[0] ?? tees[0]).id;
}

export default function CourseTeeCard({
  roundId,
  roundStatus,
  currentCourseId,
  currentCourseName,
  currentTeeName,
  courses,
  hasScores,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [courseId, setCourseId] = useState(currentCourseId);
  const [tees, setTees] = useState<CourseTeeBox[]>([]);
  const [teeBoxId, setTeeBoxId] = useState('');
  const [loadingTees, setLoadingTees] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const readOnly = roundStatus === 'completed';
  const cityState = (c: CourseLite) => [c.city, c.state].filter(Boolean).join(', ');

  async function pickCourse(id: string) {
    setCourseId(id);
    setError(null);
    setLoadingTees(true);
    const t = await getCourseTeeBoxes(id);
    setLoadingTees(false);
    setTees(t);
    setTeeBoxId(preferredTee(t));
  }

  function startEdit() {
    setEditing(true);
    if (tees.length === 0) pickCourse(currentCourseId);
  }

  const changed = courseId !== currentCourseId || (teeBoxId && tees.length > 0);

  function save() {
    if (!courseId || !teeBoxId) {
      setError('Pick a course and a tee.');
      return;
    }
    setError(null);
    startSave(async () => {
      const res = await updateRoundCourse(roundId, courseId, teeBoxId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card padding="none">
      <CardHeader className="px-4 pt-4 pb-0 mb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Course &amp; Tees</CardTitle>
          {!editing && !readOnly && (
            <button
              type="button"
              onClick={startEdit}
              className="text-sm font-medium text-golf-400 hover:text-golf-300"
            >
              Change
            </button>
          )}
        </div>
      </CardHeader>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {/* Current summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-300">Course</span>
          <span className="text-surface-50 font-medium text-right">{currentCourseName}</span>
        </div>
        {currentTeeName && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-surface-300">Default tee</span>
            <span className="text-surface-50 font-medium text-right">{currentTeeName}</span>
          </div>
        )}

        {readOnly && (
          <p className="text-xs text-surface-400">
            The round is complete — reopen it to change the course.
          </p>
        )}

        {editing && (
          <div className="mt-1 space-y-3 border-t border-surface-700 pt-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-surface-400 mb-1">
                Course
              </label>
              <select
                value={courseId}
                onChange={(e) => pickCourse(e.target.value)}
                className="w-full bg-surface-700 text-sm text-surface-100 rounded-md border border-surface-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-golf-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {cityState(c) ? `${c.name} — ${cityState(c)}` : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-surface-400 mb-1">
                Default tee
              </label>
              {loadingTees ? (
                <p className="text-sm text-surface-400">Loading tees…</p>
              ) : tees.length === 0 ? (
                <p className="text-sm text-surface-400">No tees set up for this course.</p>
              ) : (
                <select
                  value={teeBoxId}
                  onChange={(e) => setTeeBoxId(e.target.value)}
                  className="w-full bg-surface-700 text-sm text-surface-100 rounded-md border border-surface-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-golf-500"
                >
                  {tees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.course_rating} / {t.slope_rating})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <p className="text-xs text-surface-400">
              Everyone moves to this tee and handicaps re-rate. Adjust individual
              players in Tee Assignments below.
            </p>
            {hasScores && courseId !== currentCourseId && (
              <p className="rounded-md bg-gold-500/10 border border-gold-500/30 px-3 py-2 text-xs text-gold-500">
                Heads up — scores are already entered. They&apos;ll be kept but
                graded against the new course&apos;s pars.
              </p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setCourseId(currentCourseId);
                  setError(null);
                }}
                disabled={saving}
                className="text-surface-400 hover:text-surface-200"
              >
                Cancel
              </Button>
              <Button
                className="ml-auto"
                size="sm"
                onClick={save}
                loading={saving}
                disabled={saving || loadingTees || !teeBoxId || !changed}
              >
                Save course &amp; tee
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
