'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createRound } from '@/lib/actions/rounds';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  SimpleSelect,
} from '@/components/ui';

interface Course {
  id: string;
  name: string;
}

interface TeeBox {
  id: string;
  name: string;
  color: string | null;
  course_rating: number;
  slope_rating: number;
  tier: number | null;
  course_id?: string;
}

interface GroupMember {
  user_id: string;
  profile: {
    id: string;
    display_name: string;
    current_handicap_index: number | null;
    default_tee_tier: number | null;
  };
}

type WizardStep = 'course' | 'datetime' | 'players';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'course', label: 'Course' },
  { key: 'datetime', label: 'Date & Time' },
  { key: 'players', label: 'Players' },
];

interface CreateRoundWizardProps {
  groupId: string;
  groupName: string;
  defaultCourseId: string | null;
  courses: Course[];
  members: GroupMember[];
  allTeeBoxes: TeeBox[];
}

export default function CreateRoundWizard({
  groupId,
  groupName,
  defaultCourseId,
  courses,
  members,
  allTeeBoxes,
}: CreateRoundWizardProps) {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<WizardStep>('course');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedCourseId, setSelectedCourseId] = useState(defaultCourseId ?? '');
  const [teeBoxes, setTeeBoxes] = useState<TeeBox[]>([]);
  const [defaultTeeBoxId, setDefaultTeeBoxId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Filter tee boxes from pre-loaded data when course changes
  useEffect(() => {
    if (!selectedCourseId) {
      setTeeBoxes([]);
      setDefaultTeeBoxId('');
      return;
    }
    const filtered = allTeeBoxes.filter((t) => t.course_id === selectedCourseId);
    setTeeBoxes(filtered);
    if (filtered.length > 0) {
      setDefaultTeeBoxId(filtered[0].id);
    } else {
      setDefaultTeeBoxId('');
    }
  }, [selectedCourseId, allTeeBoxes]);

  // Set default date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  }, []);

  function togglePlayer(userId: string) {
    setSelectedPlayerIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  function selectAllPlayers() {
    setSelectedPlayerIds(members.map((m) => m.user_id));
  }

  function deselectAllPlayers() {
    setSelectedPlayerIds([]);
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  function goNext() {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].key);
    }
  }

  function goBack() {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
    }
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 'course':
        return !!selectedCourseId;
      case 'datetime':
        return !!date && !!time;
      case 'players':
        return selectedPlayerIds.length > 0 && !!defaultTeeBoxId;
      default:
        return false;
    }
  }

  async function handleSubmit() {
    if (!canProceed()) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set('groupId', groupId);
      formData.set('courseId', selectedCourseId);
      formData.set('teeBoxId', defaultTeeBoxId);
      formData.set('roundDate', date);
      formData.set('teeTime', time);
      selectedPlayerIds.forEach((id) => formData.append('playerIds', id));

      const result = (await createRound(formData)) as any;

      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      if (result.warning) {
        alert(result.warning);
      }

      router.push(`/rounds/${result.roundId}`);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href={`/groups/${groupId}/rounds`}
          className="text-sm text-surface-300 hover:text-surface-100 mb-2 inline-block"
        >
          &larr; Back to Rounds
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">
          Create a Round
        </h1>
        <p className="mt-1 text-sm text-surface-300">
          {groupName ? `Setting up a new round for ${groupName}.` : 'Setting up a new round.'}
        </p>
      </div>

      {/* Step Indicator */}
      <nav className="flex items-center gap-2">
        {STEPS.map((step, index) => (
          <div key={step.key} className="flex items-center">
            {index > 0 && (
              <div
                className={`h-px w-6 mx-1 ${
                  index <= currentStepIndex ? 'bg-golf-500' : 'bg-surface-500'
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => {
                if (index <= currentStepIndex) {
                  setCurrentStep(step.key);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step.key === currentStep
                  ? 'bg-emerald-900/40 text-golf-400'
                  : index < currentStepIndex
                    ? 'bg-golf-900/30 text-golf-600 cursor-pointer'
                    : 'bg-surface-700 text-surface-400 cursor-default'
              }`}
              disabled={index > currentStepIndex}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                  index < currentStepIndex
                    ? 'bg-golf-500 text-white'
                    : step.key === currentStep
                      ? 'bg-golf-600 text-white'
                      : 'bg-surface-500 text-surface-300'
                }`}
              >
                {index < currentStepIndex ? '\u2713' : index + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          </div>
        ))}
      </nav>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-900/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Step Content */}
      <Card className="max-w-2xl">
        {/* Step 1: Select Course */}
        {currentStep === 'course' && (
          <>
            <CardHeader>
              <CardTitle>Select a Course</CardTitle>
              <CardDescription>
                Choose the course you will be playing.
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 space-y-4">
              <SimpleSelect
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                options={courses.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Choose a course..."
              />
              {courses.length === 0 && (
                <p className="text-sm text-surface-300">
                  No courses available. Please add a course first.
                </p>
              )}
            </div>
          </>
        )}

        {/* Step 2: Date & Time */}
        {currentStep === 'datetime' && (
          <>
            <CardHeader>
              <CardTitle>Date & Time</CardTitle>
              <CardDescription>
                When is this round taking place?
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-surface-100"
                >
                  Date
                </label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDate(e.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="time"
                  className="block text-sm font-medium text-surface-100"
                >
                  Tee Time
                </label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTime(e.target.value)
                  }
                  required
                />
              </div>
            </div>
          </>
        )}

        {/* Step 3: Players */}
        {currentStep === 'players' && (
          <>
            <CardHeader>
              <CardTitle>Players</CardTitle>
              <CardDescription>
                Select which group members to include in this round.
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 space-y-4">
              {/* Default Tees dropdown */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-surface-100">
                  Default Tees
                </label>
                <p className="text-xs text-surface-300">
                  Fallback tee for players without a preferred tier.
                </p>
                {teeBoxes.length === 0 ? (
                  <p className="text-sm text-surface-300">
                    No tee boxes found for this course.
                  </p>
                ) : (
                  <SimpleSelect
                    value={defaultTeeBoxId}
                    onChange={(e) => setDefaultTeeBoxId(e.target.value)}
                    options={teeBoxes.map((t) => ({
                      value: t.id,
                      label: t.name,
                    }))}
                  />
                )}
              </div>

              {/* Player controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllPlayers}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={deselectAllPlayers}
                >
                  Deselect All
                </Button>
                <span className="text-sm text-surface-300 ml-auto">
                  {selectedPlayerIds.length} selected
                </span>
              </div>

              {/* Player list */}
              {members.length === 0 ? (
                <p className="text-sm text-surface-300">
                  No members found in this group.
                </p>
              ) : (
                <ul className="space-y-2">
                  {members.map((member) => {
                    const profile = member.profile as any;
                    const isSelected = selectedPlayerIds.includes(
                      member.user_id
                    );

                    return (
                      <li key={member.user_id}>
                        <div
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                            isSelected
                              ? 'border-golf-500 bg-golf-900/30'
                              : 'border-surface-500 hover:border-surface-500'
                          }`}
                        >
                          <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePlayer(member.user_id)}
                              className="h-4 w-4 shrink-0 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
                            />
                            <div className="h-8 w-8 shrink-0 rounded-full bg-emerald-900/40 flex items-center justify-center text-sm font-medium text-golf-600">
                              {(profile?.display_name ?? 'U')
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-surface-50 truncate">
                                {profile?.display_name ?? 'Unknown'}
                              </p>
                              {profile?.current_handicap_index != null && (
                                <p className="text-xs text-surface-300">
                                  Handicap: {profile.current_handicap_index}
                                </p>
                              )}
                            </div>
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2 border-t border-surface-600">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={currentStepIndex === 0}
          >
            Back
          </Button>

          {currentStep === 'players' ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
            >
              {isSubmitting ? 'Creating Round...' : 'Create Round'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canProceed()}
            >
              Next
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
