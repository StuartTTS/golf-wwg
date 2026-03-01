'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/supabase-provider';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CourseSearchPanel } from '@/components/courses/course-search-panel';

type Step = 'details' | 'teeboxes' | 'holes';

interface CourseDetails {
  name: string;
  city: string;
  state: string;
  country: string;
  holesCount: '9' | '18';
  isPublic: boolean;
}

interface TeeBox {
  id: string;
  name: string;
  color: string;
  rating: string;
  slope: string;
  yardage: string;
}

interface HoleData {
  number: number;
  par: string;
  yardage: string;
  strokeIndex: string;
}

interface TeeBoxHoles {
  teeBoxId: string;
  holes: HoleData[];
}

const TEE_COLORS = [
  'Black',
  'Blue',
  'White',
  'Gold',
  'Green',
  'Red',
  'Silver',
  'Copper',
  'Combo',
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'details', label: 'Course Details' },
    { key: 'teeboxes', label: 'Tee Boxes' },
    { key: 'holes', label: 'Holes' },
  ];

  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex items-center gap-2">
          <div
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
              ${
                idx <= currentIndex
                  ? 'bg-emerald-900/40 text-golf-600 font-medium'
                  : 'bg-surface-700 text-surface-400'
              }
            `}
          >
            <span
              className={`
                w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${
                  idx < currentIndex
                    ? 'bg-golf-600 text-white'
                    : idx === currentIndex
                    ? 'bg-golf-600 text-white'
                    : 'bg-surface-500 text-white'
                }
              `}
            >
              {idx < currentIndex ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                idx + 1
              )}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 ${
                idx < currentIndex ? 'bg-golf-400' : 'bg-surface-600'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CourseDetailsStep({
  details,
  onChange,
  onNext,
}: {
  details: CourseDetails;
  onChange: (d: CourseDetails) => void;
  onNext: () => void;
}) {
  const isValid = details.name.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Details</CardTitle>
        <CardDescription>
          Enter the basic information about the course
        </CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-100 mb-1">
            Course Name *
          </label>
          <Input
            value={details.name}
            onChange={(e) => onChange({ ...details, name: e.target.value })}
            placeholder="e.g. Pine Valley Golf Club"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-100 mb-1">
              City
            </label>
            <Input
              value={details.city}
              onChange={(e) => onChange({ ...details, city: e.target.value })}
              placeholder="City"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-100 mb-1">
              State
            </label>
            <Select
              value={details.state}
              onValueChange={(v) => onChange({ ...details, state: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-100 mb-1">
            Number of Holes
          </label>
          <Select
            value={details.holesCount}
            onValueChange={(v) =>
              onChange({ ...details, holesCount: v as '9' | '18' })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9">9 Holes</SelectItem>
              <SelectItem value="18">18 Holes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={details.isPublic}
            onChange={(e) =>
              onChange({ ...details, isPublic: e.target.checked })
            }
            className="rounded border-surface-500 text-golf-600 focus:ring-golf-500"
          />
          <label htmlFor="isPublic" className="text-sm text-surface-100">
            Make this course visible to other users
          </label>
        </div>

        <div className="pt-4">
          <Button className="w-full" disabled={!isValid} onClick={onNext}>
            Next: Add Tee Boxes
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TeeBoxesStep({
  teeBoxes,
  onChange,
  onBack,
  onNext,
}: {
  teeBoxes: TeeBox[];
  onChange: (tb: TeeBox[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const addTeeBox = () => {
    onChange([
      ...teeBoxes,
      {
        id: generateId(),
        name: '',
        color: '',
        rating: '',
        slope: '',
        yardage: '',
      },
    ]);
  };

  const updateTeeBox = (idx: number, updates: Partial<TeeBox>) => {
    const updated = [...teeBoxes];
    updated[idx] = { ...updated[idx], ...updates };
    onChange(updated);
  };

  const removeTeeBox = (idx: number) => {
    onChange(teeBoxes.filter((_, i) => i !== idx));
  };

  const isValid =
    teeBoxes.length > 0 &&
    teeBoxes.every(
      (tb) =>
        tb.name.trim().length > 0 &&
        parseFloat(tb.rating) > 0 &&
        parseInt(tb.slope) > 0
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tee Boxes</CardTitle>
        <CardDescription>
          Add the tee boxes available at this course with their ratings
        </CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        {teeBoxes.map((teeBox, idx) => (
          <div
            key={teeBox.id}
            className="p-4 border border-surface-500 rounded-lg space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-surface-100">
                Tee Box {idx + 1}
              </h4>
              {teeBoxes.length > 1 && (
                <button
                  onClick={() => removeTeeBox(idx)}
                  className="text-red-500 hover:text-red-400 text-sm"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-surface-200 mb-1">
                  Name *
                </label>
                <Input
                  value={teeBox.name}
                  onChange={(e) =>
                    updateTeeBox(idx, { name: e.target.value })
                  }
                  placeholder="e.g. Blue"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-200 mb-1">
                  Color
                </label>
                <Select
                  value={teeBox.color}
                  onValueChange={(v) => updateTeeBox(idx, { color: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Color" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEE_COLORS.map((c) => (
                      <SelectItem key={c} value={c.toLowerCase()}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-surface-200 mb-1">
                  Rating *
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={teeBox.rating}
                  onChange={(e) =>
                    updateTeeBox(idx, { rating: e.target.value })
                  }
                  placeholder="72.1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-200 mb-1">
                  Slope *
                </label>
                <Input
                  type="number"
                  value={teeBox.slope}
                  onChange={(e) =>
                    updateTeeBox(idx, { slope: e.target.value })
                  }
                  placeholder="131"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-200 mb-1">
                  Yardage
                </label>
                <Input
                  type="number"
                  value={teeBox.yardage}
                  onChange={(e) =>
                    updateTeeBox(idx, { yardage: e.target.value })
                  }
                  placeholder="6800"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addTeeBox}
          className="w-full p-3 border-2 border-dashed border-surface-500 rounded-lg text-sm text-surface-300 hover:border-golf-400 hover:text-golf-600 transition-colors"
        >
          + Add Another Tee Box
        </button>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={onBack}>
            Back
          </Button>
          <Button className="flex-1" disabled={!isValid} onClick={onNext}>
            Next: Add Holes
          </Button>
        </div>
      </div>
    </Card>
  );
}

function HolesStep({
  teeBoxes,
  holesCount,
  teeBoxHoles,
  onChange,
  onBack,
  onSubmit,
  saving,
}: {
  teeBoxes: TeeBox[];
  holesCount: number;
  teeBoxHoles: TeeBoxHoles[];
  onChange: (tbh: TeeBoxHoles[]) => void;
  onBack: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const [activeTeeBox, setActiveTeeBox] = useState(0);

  const currentTeeBoxHoles = teeBoxHoles[activeTeeBox]?.holes ?? [];

  const updateHole = (holeIdx: number, updates: Partial<HoleData>) => {
    const updated = [...teeBoxHoles];
    const holes = [...updated[activeTeeBox].holes];
    holes[holeIdx] = { ...holes[holeIdx], ...updates };
    updated[activeTeeBox] = { ...updated[activeTeeBox], holes };
    onChange(updated);
  };

  const applyDefaultPars = () => {
    const defaultPars18 = [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 3, 4, 5, 4];
    const defaultPars9 = defaultPars18.slice(0, 9);
    const pars = holesCount === 18 ? defaultPars18 : defaultPars9;

    const updated = [...teeBoxHoles];
    const holes = updated[activeTeeBox].holes.map((h, i) => ({
      ...h,
      par: pars[i]?.toString() ?? '4',
      strokeIndex: h.strokeIndex || (i + 1).toString(),
    }));
    updated[activeTeeBox] = { ...updated[activeTeeBox], holes };
    onChange(updated);
  };

  const isValid = teeBoxHoles.every((tbh) =>
    tbh.holes.every(
      (h) =>
        parseInt(h.par) >= 3 &&
        parseInt(h.par) <= 6 &&
        parseInt(h.strokeIndex) >= 1
    )
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hole Details</CardTitle>
        <CardDescription>
          Enter par, yardage, and stroke index for each hole per tee box
        </CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        {/* Tee box tabs */}
        {teeBoxes.length > 1 && (
          <div className="flex gap-2 border-b border-surface-500 pb-2">
            {teeBoxes.map((tb, idx) => (
              <button
                key={tb.id}
                onClick={() => setActiveTeeBox(idx)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    idx === activeTeeBox
                      ? 'bg-emerald-900/40 text-golf-600'
                      : 'text-surface-300 hover:text-surface-100'
                  }
                `}
              >
                {tb.name || `Tee ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={applyDefaultPars}
            className="text-xs text-golf-600 hover:text-golf-600 font-medium"
          >
            Apply Default Pars
          </button>
        </div>

        {/* Holes table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-500">
                <th className="text-left py-2 px-2 text-xs font-semibold text-surface-300 w-16">
                  Hole
                </th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-surface-300">
                  Par
                </th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-surface-300">
                  Yardage
                </th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-surface-300">
                  SI
                </th>
              </tr>
            </thead>
            <tbody>
              {currentTeeBoxHoles.map((hole, idx) => (
                <tr
                  key={hole.number}
                  className={`border-b border-surface-600 ${
                    hole.number === 10 ? 'border-t-2 border-t-surface-500' : ''
                  }`}
                >
                  <td className="py-1.5 px-2">
                    <span className="text-sm font-medium text-surface-100">
                      {hole.number}
                    </span>
                  </td>
                  <td className="py-1.5 px-2">
                    <Select
                      value={hole.par}
                      onValueChange={(v) => updateHole(idx, { par: v })}
                    >
                      <SelectTrigger className="w-16 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="6">6</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      type="number"
                      value={hole.yardage}
                      onChange={(e) =>
                        updateHole(idx, { yardage: e.target.value })
                      }
                      className="w-20 h-8 text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      type="number"
                      min="1"
                      max={holesCount}
                      value={hole.strokeIndex}
                      onChange={(e) =>
                        updateHole(idx, { strokeIndex: e.target.value })
                      }
                      className="w-16 h-8 text-sm"
                      placeholder="1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="flex justify-between text-sm text-surface-200 bg-surface-700 p-3 rounded-lg">
          <span>
            Front 9 Par:{' '}
            <strong>
              {currentTeeBoxHoles
                .filter((h) => h.number <= 9)
                .reduce((sum, h) => sum + (parseInt(h.par) || 0), 0)}
            </strong>
          </span>
          {holesCount === 18 && (
            <span>
              Back 9 Par:{' '}
              <strong>
                {currentTeeBoxHoles
                  .filter((h) => h.number > 9)
                  .reduce((sum, h) => sum + (parseInt(h.par) || 0), 0)}
              </strong>
            </span>
          )}
          <span>
            Total Par:{' '}
            <strong>
              {currentTeeBoxHoles.reduce(
                (sum, h) => sum + (parseInt(h.par) || 0),
                0
              )}
            </strong>
          </span>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={onBack}>
            Back
          </Button>
          <Button
            className="flex-1"
            disabled={!isValid || saving}
            onClick={onSubmit}
          >
            {saving ? 'Creating Course...' : 'Create Course'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function NewCoursePage() {
  const router = useRouter();
  const { supabase } = useSupabase();
  const { user } = useAuth();

  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [step, setStep] = useState<Step>('details');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [details, setDetails] = useState<CourseDetails>({
    name: '',
    city: '',
    state: '',
    country: 'US',
    holesCount: '18',
    isPublic: false,
  });

  const [teeBoxes, setTeeBoxes] = useState<TeeBox[]>([
    {
      id: generateId(),
      name: 'White',
      color: 'white',
      rating: '',
      slope: '',
      yardage: '',
    },
  ]);

  const [teeBoxHoles, setTeeBoxHoles] = useState<TeeBoxHoles[]>([]);

  const initializeHoles = useCallback(() => {
    const count = parseInt(details.holesCount);
    const holes: TeeBoxHoles[] = teeBoxes.map((tb) => ({
      teeBoxId: tb.id,
      holes: Array.from({ length: count }, (_, i) => ({
        number: i + 1,
        par: '4',
        yardage: '',
        strokeIndex: (i + 1).toString(),
      })),
    }));
    setTeeBoxHoles(holes);
  }, [teeBoxes, details.holesCount]);

  const handleGoToHoles = () => {
    initializeHoles();
    setStep('holes');
  };

  const handleSubmit = async () => {
    if (!supabase || !user) return;

    try {
      setSaving(true);
      setError(null);

      // Create course
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .insert({
          name: details.name.trim(),
          city: details.city.trim() || null,
          state: details.state || null,
          country: details.country,
          num_holes: parseInt(details.holesCount),
          created_by: user.id,
        })
        .select('id')
        .single();

      if (courseError) throw courseError;

      const courseId = courseData.id;

      // Create tee boxes
      for (let i = 0; i < teeBoxes.length; i++) {
        const tb = teeBoxes[i];
        const { data: teeData, error: teeError } = await supabase
          .from('tee_boxes')
          .insert({
            course_id: courseId,
            name: tb.name.trim(),
            color: tb.color || null,
            course_rating: parseFloat(tb.rating) || 0,
            slope_rating: parseInt(tb.slope) || 0,
            total_yardage: parseInt(tb.yardage) || null,
          })
          .select('id')
          .single();

        if (teeError) throw teeError;

        // Create holes for this tee box
        const tbHoles = teeBoxHoles.find(
          (tbh) => tbh.teeBoxId === tb.id
        );
        if (tbHoles) {
          const holesInsert = tbHoles.holes.map((h) => ({
            tee_box_id: teeData.id,
            hole_number: h.number,
            par: parseInt(h.par) || 4,
            yardage: parseInt(h.yardage) || null,
            handicap_index: parseInt(h.strokeIndex) || h.number,
          }));

          const { error: holesError } = await supabase
            .from('holes')
            .insert(holesInsert);

          if (holesError) throw holesError;
        }
      }

      setSaving(false);
      router.push(`/courses/${courseId}`);
    } catch (err: any) {
      console.error('Course creation failed:', err);
      setError(err.message ?? 'Failed to create course');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <button
          onClick={() => router.push('/courses')}
          className="text-sm text-surface-300 hover:text-surface-100 flex items-center gap-1 mb-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Courses
        </button>
        <h1 className="text-2xl font-bold text-surface-50">New Course</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('search')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'search'
              ? 'bg-emerald-900/40 text-golf-600'
              : 'bg-surface-700 text-surface-300 hover:text-surface-100'
          }`}
        >
          Search Database
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-emerald-900/40 text-golf-600'
              : 'bg-surface-700 text-surface-300 hover:text-surface-100'
          }`}
        >
          Create Manually
        </button>
      </div>

      {mode === 'search' ? (
        <Card>
          <CardHeader>
            <CardTitle>Search Course Database</CardTitle>
            <CardDescription>
              Search our database of golf courses to quickly add one with all tee boxes and hole data pre-filled.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <CourseSearchPanel />
          </div>
        </Card>
      ) : (
        <>
          <StepIndicator currentStep={step} />

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-200 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {step === 'details' && (
            <CourseDetailsStep
              details={details}
              onChange={setDetails}
              onNext={() => setStep('teeboxes')}
            />
          )}

          {step === 'teeboxes' && (
            <TeeBoxesStep
              teeBoxes={teeBoxes}
              onChange={setTeeBoxes}
              onBack={() => setStep('details')}
              onNext={handleGoToHoles}
            />
          )}

          {step === 'holes' && (
            <HolesStep
              teeBoxes={teeBoxes}
              holesCount={parseInt(details.holesCount)}
              teeBoxHoles={teeBoxHoles}
              onChange={setTeeBoxHoles}
              onBack={() => setStep('teeboxes')}
              onSubmit={handleSubmit}
              saving={saving}
            />
          )}
        </>
      )}
    </div>
  );
}
