'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/supabase-provider';
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
  dbId?: string;
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
  'Black', 'Blue', 'White', 'Gold', 'Green', 'Red', 'Silver', 'Copper', 'Combo',
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

export default function EditCoursePage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const courseId = params.courseId;

  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(true);
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

  const [teeBoxes, setTeeBoxes] = useState<TeeBox[]>([]);
  const [teeBoxHoles, setTeeBoxHoles] = useState<TeeBoxHoles[]>([]);
  const [activeTeeBox, setActiveTeeBox] = useState(0);

  // Fetch existing course data
  useEffect(() => {
    async function fetchCourse() {
      if (!supabase || !courseId) return;

      try {
        setLoading(true);

        const { data: course, error: courseError } = await supabase
          .from('courses')
          .select(`
            id,
            name,
            city,
            state,
            country,
            num_holes,
            created_by,
            tee_boxes (
              id,
              name,
              color,
              course_rating,
              slope_rating,
              total_yardage,
              holes (
                hole_number,
                par,
                yardage,
                handicap_index
              )
            )
          `)
          .eq('id', courseId)
          .single() as { data: any; error: any };

        if (courseError) throw courseError;

        setDetails({
          name: course.name,
          city: course.city ?? '',
          state: course.state ?? '',
          country: course.country ?? 'US',
          holesCount: course.num_holes.toString() as '9' | '18',
          isPublic: false,
        });

        const loadedTeeBoxes: TeeBox[] = (course.tee_boxes ?? []).map(
          (tb: any) => ({
            id: generateId(),
            dbId: tb.id,
            name: tb.name,
            color: tb.color ?? '',
            rating: tb.course_rating?.toString() ?? '',
            slope: tb.slope_rating?.toString() ?? '',
            yardage: tb.total_yardage?.toString() ?? '',
          })
        );
        setTeeBoxes(loadedTeeBoxes);

        const loadedHoles: TeeBoxHoles[] = (course.tee_boxes ?? []).map(
          (tb: any, idx: number) => ({
            teeBoxId: loadedTeeBoxes[idx].id,
            holes: (tb.holes ?? [])
              .sort((a: any, b: any) => a.hole_number - b.hole_number)
              .map((h: any) => ({
                number: h.hole_number,
                par: h.par?.toString() ?? '4',
                yardage: h.yardage?.toString() ?? '',
                strokeIndex: h.handicap_index?.toString() ?? '',
              })),
          })
        );
        setTeeBoxHoles(loadedHoles);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load course');
      } finally {
        setLoading(false);
      }
    }

    fetchCourse();
  }, [supabase, courseId]);

  const updateTeeBox = (idx: number, updates: Partial<TeeBox>) => {
    const updated = [...teeBoxes];
    updated[idx] = { ...updated[idx], ...updates };
    setTeeBoxes(updated);
  };

  const addTeeBox = () => {
    const newId = generateId();
    setTeeBoxes([
      ...teeBoxes,
      { id: newId, name: '', color: '', rating: '', slope: '', yardage: '' },
    ]);
    const holesCount = parseInt(details.holesCount);
    setTeeBoxHoles([
      ...teeBoxHoles,
      {
        teeBoxId: newId,
        holes: Array.from({ length: holesCount }, (_, i) => ({
          number: i + 1,
          par: '4',
          yardage: '',
          strokeIndex: (i + 1).toString(),
        })),
      },
    ]);
  };

  const removeTeeBox = (idx: number) => {
    const tbId = teeBoxes[idx].id;
    setTeeBoxes(teeBoxes.filter((_, i) => i !== idx));
    setTeeBoxHoles(teeBoxHoles.filter((tbh) => tbh.teeBoxId !== tbId));
    if (activeTeeBox >= teeBoxes.length - 1) {
      setActiveTeeBox(Math.max(0, teeBoxes.length - 2));
    }
  };

  const updateHole = (teeBoxIdx: number, holeIdx: number, updates: Partial<HoleData>) => {
    const updated = [...teeBoxHoles];
    const holes = [...updated[teeBoxIdx].holes];
    holes[holeIdx] = { ...holes[holeIdx], ...updates };
    updated[teeBoxIdx] = { ...updated[teeBoxIdx], holes };
    setTeeBoxHoles(updated);
  };

  const handleSave = async () => {
    if (!supabase || !user) return;

    try {
      setSaving(true);
      setError(null);

      // Update course details
      const { error: courseError } = await supabase
        .from('courses')
        .update({
          name: details.name.trim(),
          city: details.city.trim() || null,
          state: details.state || null,
          country: details.country,
          num_holes: parseInt(details.holesCount),
        })
        .eq('id', courseId);

      if (courseError) throw courseError;

      // Delete existing tee boxes and holes (cascade)
      const { error: deleteError } = await supabase
        .from('tee_boxes')
        .delete()
        .eq('course_id', courseId);

      if (deleteError) throw deleteError;

      // Re-create tee boxes and holes
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

        const tbHoles = teeBoxHoles.find((tbh) => tbh.teeBoxId === tb.id);
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
      console.error('Course save failed:', err);
      setError(err.message ?? 'Failed to save course');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-golf-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentTeeBoxHoles = teeBoxHoles[activeTeeBox]?.holes ?? [];
  const holesCount = parseInt(details.holesCount);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <button
          onClick={() => router.push(`/courses/${courseId}`)}
          className="text-sm text-surface-300 hover:text-surface-100 flex items-center gap-1 mb-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Course
        </button>
        <h1 className="text-2xl font-bold text-surface-50">Edit Course</h1>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-200 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Step tabs */}
      <div className="flex gap-2 border-b border-surface-500 pb-2">
        {(['details', 'teeboxes', 'holes'] as Step[]).map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${step === s ? 'bg-emerald-900/40 text-golf-600' : 'text-surface-300 hover:text-surface-100'}
            `}
          >
            {s === 'details'
              ? 'Course Details'
              : s === 'teeboxes'
              ? 'Tee Boxes'
              : 'Holes'}
          </button>
        ))}
      </div>

      {/* Details step */}
      {step === 'details' && (
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-100 mb-1">
                Course Name *
              </label>
              <Input
                value={details.name}
                onChange={(e) =>
                  setDetails({ ...details, name: e.target.value })
                }
                placeholder="Course name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1">
                  City
                </label>
                <Input
                  value={details.city}
                  onChange={(e) =>
                    setDetails({ ...details, city: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1">
                  State
                </label>
                <Select
                  value={details.state}
                  onValueChange={(v) => setDetails({ ...details, state: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
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
                Holes
              </label>
              <Select
                value={details.holesCount}
                onValueChange={(v) =>
                  setDetails({ ...details, holesCount: v as '9' | '18' })
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
                  setDetails({ ...details, isPublic: e.target.checked })
                }
                className="rounded border-surface-500 text-golf-600 focus:ring-golf-500"
              />
              <label htmlFor="isPublic" className="text-sm text-surface-100">
                Public course
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* Tee boxes step */}
      {step === 'teeboxes' && (
        <Card>
          <CardHeader>
            <CardTitle>Tee Boxes</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6 space-y-4">
            {teeBoxes.map((tb, idx) => (
              <div
                key={tb.id}
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
                      Name
                    </label>
                    <Input
                      value={tb.name}
                      onChange={(e) =>
                        updateTeeBox(idx, { name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-200 mb-1">
                      Color
                    </label>
                    <Select
                      value={tb.color}
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
                      Rating
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={tb.rating}
                      onChange={(e) =>
                        updateTeeBox(idx, { rating: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-200 mb-1">
                      Slope
                    </label>
                    <Input
                      type="number"
                      value={tb.slope}
                      onChange={(e) =>
                        updateTeeBox(idx, { slope: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-200 mb-1">
                      Yardage
                    </label>
                    <Input
                      type="number"
                      value={tb.yardage}
                      onChange={(e) =>
                        updateTeeBox(idx, { yardage: e.target.value })
                      }
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
          </div>
        </Card>
      )}

      {/* Holes step */}
      {step === 'holes' && (
        <Card>
          <CardHeader>
            <CardTitle>Hole Details</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6 space-y-4">
            {teeBoxes.length > 1 && (
              <div className="flex gap-2 border-b border-surface-500 pb-2">
                {teeBoxes.map((tb, idx) => (
                  <button
                    key={tb.id}
                    onClick={() => setActiveTeeBox(idx)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${idx === activeTeeBox ? 'bg-emerald-900/40 text-golf-600' : 'text-surface-300 hover:text-surface-100'}
                    `}
                  >
                    {tb.name || `Tee ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

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
                      <td className="py-1.5 px-2 text-sm font-medium text-surface-100">
                        {hole.number}
                      </td>
                      <td className="py-1.5 px-2">
                        <Select
                          value={hole.par}
                          onValueChange={(v) =>
                            updateHole(activeTeeBox, idx, { par: v })
                          }
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
                            updateHole(activeTeeBox, idx, {
                              yardage: e.target.value,
                            })
                          }
                          className="w-20 h-8 text-sm"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          type="number"
                          min="1"
                          max={holesCount}
                          value={hole.strokeIndex}
                          onChange={(e) =>
                            updateHole(activeTeeBox, idx, {
                              strokeIndex: e.target.value,
                            })
                          }
                          className="w-16 h-8 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between text-sm text-surface-200 bg-surface-700 p-3 rounded-lg">
              <span>
                Front 9:{' '}
                <strong>
                  {currentTeeBoxHoles
                    .filter((h) => h.number <= 9)
                    .reduce((sum, h) => sum + (parseInt(h.par) || 0), 0)}
                </strong>
              </span>
              {holesCount === 18 && (
                <span>
                  Back 9:{' '}
                  <strong>
                    {currentTeeBoxHoles
                      .filter((h) => h.number > 9)
                      .reduce((sum, h) => sum + (parseInt(h.par) || 0), 0)}
                  </strong>
                </span>
              )}
              <span>
                Total:{' '}
                <strong>
                  {currentTeeBoxHoles.reduce(
                    (sum, h) => sum + (parseInt(h.par) || 0),
                    0
                  )}
                </strong>
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Save button */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/courses/${courseId}`)}
        >
          Cancel
        </Button>
        <Button className="flex-1" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
