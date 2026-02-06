'use client';

import { useState } from 'react';
import { Button, Input, SimpleSelect } from '@/components/ui';

interface Course {
  id: string;
  name: string;
  teeBoxes: { id: string; name: string; slopeRating: number; courseRating: number }[];
}

interface GroupMember {
  userId: string;
  displayName: string;
}

interface RoundWizardProps {
  courses: Course[];
  groupMembers: GroupMember[];
  groupId: string;
  onSubmit: (data: {
    courseId: string;
    teeBoxId: string;
    roundDate: string;
    teeTime: string;
    scoringMode: string;
    playerIds: string[];
  }) => Promise<{ error?: string; roundId?: string }>;
}

type Step = 'course' | 'details' | 'players';

export function RoundWizard({ courses, groupMembers, groupId, onSubmit }: RoundWizardProps) {
  const [step, setStep] = useState<Step>('course');
  const [courseId, setCourseId] = useState('');
  const [teeBoxId, setTeeBoxId] = useState('');
  const [roundDate, setRoundDate] = useState(new Date().toISOString().split('T')[0]);
  const [teeTime, setTeeTime] = useState('08:00');
  const [scoringMode, setScoringMode] = useState('shared');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedCourse = courses.find((c) => c.id === courseId);
  const teeBoxOptions = selectedCourse?.teeBoxes.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.slopeRating}/${t.courseRating})`,
  })) || [];

  const togglePlayer = (userId: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const result = await onSubmit({
      courseId,
      teeBoxId,
      roundDate,
      teeTime,
      scoringMode,
      playerIds: selectedPlayers,
    });
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['course', 'details', 'players'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-golf-600 text-white'
                  : i < ['course', 'details', 'players'].indexOf(step)
                    ? 'bg-golf-100 text-golf-700'
                    : 'bg-dark-200 text-dark-500'
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && <div className="h-px w-8 bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step: Course Selection */}
      {step === 'course' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Select Course</h2>
          <SimpleSelect
            id="courseId"
            label="Course"
            options={courses.map((c) => ({ value: c.id, label: c.name }))}
            value={courseId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setCourseId(e.target.value);
              setTeeBoxId('');
            }}
            placeholder="Choose a course"
          />
          {courseId && (
            <SimpleSelect
              id="teeBoxId"
              label="Tee Box"
              options={teeBoxOptions}
              value={teeBoxId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTeeBoxId(e.target.value)}
              placeholder="Choose tees"
            />
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => setStep('details')}
              disabled={!courseId || !teeBoxId}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Step: Details */}
      {step === 'details' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Round Details</h2>
          <Input
            id="roundDate"
            label="Date"
            type="date"
            value={roundDate}
            onChange={(e) => setRoundDate(e.target.value)}
          />
          <Input
            id="teeTime"
            label="Tee Time"
            type="time"
            value={teeTime}
            onChange={(e) => setTeeTime(e.target.value)}
          />
          <SimpleSelect
            id="scoringMode"
            label="Scoring Mode"
            options={[
              { value: 'shared', label: 'Shared - Any player can enter scores' },
              { value: 'scorekeeper', label: 'Scorekeeper - One person enters all scores' },
            ]}
            value={scoringMode}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setScoringMode(e.target.value)}
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('course')}>
              Back
            </Button>
            <Button onClick={() => setStep('players')}>Next</Button>
          </div>
        </div>
      )}

      {/* Step: Players */}
      {step === 'players' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Add Players</h2>
          <p className="text-sm text-dark-600">
            Select group members to include in this round.
          </p>
          <div className="space-y-2">
            {groupMembers.map((member) => (
              <label
                key={member.userId}
                className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                  selectedPlayers.includes(member.userId)
                    ? 'border-golf-400 bg-golf-50'
                    : 'border-dark-300 hover:border-dark-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedPlayers.includes(member.userId)}
                  onChange={() => togglePlayer(member.userId)}
                  className="rounded border-dark-300 text-golf-600 focus:ring-golf-500"
                />
                <span className="text-sm font-medium">{member.displayName}</span>
              </label>
            ))}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('details')}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              loading={loading}
              disabled={selectedPlayers.length === 0}
            >
              Create Round
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
