'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/providers/supabase-provider';
import { createRound } from '@/lib/actions/rounds';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  SimpleSelect,
  Badge,
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
}

interface GroupMember {
  user_id: string;
  profile: {
    id: string;
    full_name: string;
    handicap: number | null;
  };
}

type WizardStep = 'course' | 'tee' | 'datetime' | 'scoring' | 'players';

const SCORING_MODES = [
  { value: 'stroke', label: 'Stroke Play', description: 'Total strokes per hole' },
  { value: 'stableford', label: 'Stableford', description: 'Points-based scoring' },
  { value: 'match', label: 'Match Play', description: 'Hole-by-hole winner' },
  { value: 'skins', label: 'Skins', description: 'Win skins for each hole' },
  { value: 'best_ball', label: 'Best Ball', description: 'Team best score per hole' },
];

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'course', label: 'Course' },
  { key: 'tee', label: 'Tee Box' },
  { key: 'datetime', label: 'Date & Time' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'players', label: 'Players' },
];

interface CreateRoundPageProps {
  params: Promise<{ groupId: string }>;
}

export default function CreateRoundPage({ params }: CreateRoundPageProps) {
  const router = useRouter();
  const { supabase } = useSupabase();

  const [groupId, setGroupId] = useState<string>('');
  const [groupName, setGroupName] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<WizardStep>('course');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [teeBoxes, setTeeBoxes] = useState<TeeBox[]>([]);
  const [selectedTeeBoxId, setSelectedTeeBoxId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [scoringMode, setScoringMode] = useState('stroke');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Resolve params
  useEffect(() => {
    params.then(({ groupId: gId }) => setGroupId(gId));
  }, [params]);

  // Fetch group info
  useEffect(() => {
    if (!groupId) return;
    async function fetchGroup() {
      const { data } = await supabase
        .from('groups')
        .select('name, default_course_id')
        .eq('id', groupId)
        .single();
      if (data) {
        setGroupName(data.name);
        if (data.default_course_id) {
          setSelectedCourseId(data.default_course_id);
        }
      }
    }
    fetchGroup();
  }, [groupId, supabase]);

  // Fetch courses
  useEffect(() => {
    async function fetchCourses() {
      const { data } = await supabase
        .from('courses')
        .select('id, name')
        .order('name', { ascending: true });
      if (data) setCourses(data);
    }
    fetchCourses();
  }, [supabase]);

  // Fetch tee boxes when course changes
  useEffect(() => {
    if (!selectedCourseId) {
      setTeeBoxes([]);
      setSelectedTeeBoxId('');
      return;
    }
    async function fetchTeeBoxes() {
      const { data } = await supabase
        .from('tee_boxes')
        .select('id, name, color, course_rating, slope_rating')
        .eq('course_id', selectedCourseId)
        .order('course_rating', { ascending: true });
      if (data) {
        setTeeBoxes(data);
        if (data.length > 0) {
          setSelectedTeeBoxId(data[0].id);
        }
      }
    }
    fetchTeeBoxes();
  }, [selectedCourseId, supabase]);

  // Fetch group members
  useEffect(() => {
    if (!groupId) return;
    async function fetchMembers() {
      const { data } = await supabase
        .from('group_members')
        .select('user_id, profile:profiles(id, full_name, handicap)')
        .eq('group_id', groupId);
      if (data) {
        setMembers(data as any);
      }
    }
    fetchMembers();
  }, [groupId, supabase]);

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
      case 'tee':
        return !!selectedTeeBoxId;
      case 'datetime':
        return !!date && !!time;
      case 'scoring':
        return !!scoringMode;
      case 'players':
        return selectedPlayerIds.length > 0;
      default:
        return false;
    }
  }

  async function handleSubmit() {
    if (!canProceed()) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const dateTime = new Date(`${date}T${time}`).toISOString();

      const formData = new FormData();
      formData.set('groupId', groupId);
      formData.set('courseId', selectedCourseId);
      formData.set('teeBoxId', selectedTeeBoxId);
      formData.set('roundDate', dateTime);
      formData.set('scoringMode', scoringMode);
      selectedPlayerIds.forEach((id) => formData.append('playerIds', id));

      const result = await createRound(formData);

      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
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
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Back to Rounds
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Create a Round
        </h1>
        <p className="mt-1 text-sm text-gray-500">
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
                  index <= currentStepIndex ? 'bg-green-500' : 'bg-gray-300'
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
                  ? 'bg-green-100 text-green-800'
                  : index < currentStepIndex
                    ? 'bg-green-50 text-green-600 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-default'
              }`}
              disabled={index > currentStepIndex}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                  index < currentStepIndex
                    ? 'bg-green-500 text-white'
                    : step.key === currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-500'
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
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
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
                <p className="text-sm text-gray-500">
                  No courses available. Please add a course first.
                </p>
              )}
            </div>
          </>
        )}

        {/* Step 2: Select Tee Box */}
        {currentStep === 'tee' && (
          <>
            <CardHeader>
              <CardTitle>Select a Tee Box</CardTitle>
              <CardDescription>
                Choose which tees players will be playing from.
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 space-y-3">
              {teeBoxes.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No tee boxes found for this course.
                </p>
              ) : (
                teeBoxes.map((tee) => (
                  <label
                    key={tee.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedTeeBoxId === tee.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="teeBox"
                        value={tee.id}
                        checked={selectedTeeBoxId === tee.id}
                        onChange={() => setSelectedTeeBoxId(tee.id)}
                        className="sr-only"
                      />
                      <div
                        className="w-4 h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: tee.color || undefined }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {tee.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Rating: {tee.course_rating} / Slope: {tee.slope_rating}
                        </p>
                      </div>
                    </div>
                    {selectedTeeBoxId === tee.id && (
                      <Badge variant="default">Selected</Badge>
                    )}
                  </label>
                ))
              )}
            </div>
          </>
        )}

        {/* Step 3: Date & Time */}
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
                  className="block text-sm font-medium text-gray-700"
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
                  className="block text-sm font-medium text-gray-700"
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

        {/* Step 4: Scoring Mode */}
        {currentStep === 'scoring' && (
          <>
            <CardHeader>
              <CardTitle>Scoring Mode</CardTitle>
              <CardDescription>
                How do you want to keep score?
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 space-y-3">
              {SCORING_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    scoringMode === mode.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <input
                      type="radio"
                      name="scoringMode"
                      value={mode.value}
                      checked={scoringMode === mode.value}
                      onChange={() => setScoringMode(mode.value)}
                      className="sr-only"
                    />
                    <p className="text-sm font-medium text-gray-900">
                      {mode.label}
                    </p>
                    <p className="text-xs text-gray-500">{mode.description}</p>
                  </div>
                  {scoringMode === mode.value && (
                    <Badge variant="default">Selected</Badge>
                  )}
                </label>
              ))}
            </div>
          </>
        )}

        {/* Step 5: Players */}
        {currentStep === 'players' && (
          <>
            <CardHeader>
              <CardTitle>Add Players</CardTitle>
              <CardDescription>
                Select which group members are playing in this round.
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 space-y-4">
              <div className="flex items-center gap-2">
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
                <span className="text-sm text-gray-500 ml-auto">
                  {selectedPlayerIds.length} selected
                </span>
              </div>

              {members.length === 0 ? (
                <p className="text-sm text-gray-500">
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
                        <label
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePlayer(member.user_id)}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-medium text-green-700">
                            {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {profile?.full_name ?? 'Unknown'}
                            </p>
                            {profile?.handicap != null && (
                              <p className="text-xs text-gray-500">
                                Handicap: {profile.handicap}
                              </p>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2 border-t border-gray-100">
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
