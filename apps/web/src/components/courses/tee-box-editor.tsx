'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';

interface HoleData {
  holeNumber: number;
  par: number;
  yardage: number;
  handicapIndex: number;
}

interface TeeBoxData {
  name: string;
  color: string;
  slopeRating: number;
  courseRating: number;
  totalYardage: number;
  holes: HoleData[];
}

interface TeeBoxEditorProps {
  numHoles: number;
  onSave: (teeBox: TeeBoxData) => Promise<void>;
}

const DEFAULT_PARS = [4, 4, 3, 4, 3, 4, 5, 4, 4, 4, 4, 5, 4, 3, 5, 4, 3, 4];

export function TeeBoxEditor({ numHoles, onSave }: TeeBoxEditorProps) {
  const [teeBox, setTeeBox] = useState<TeeBoxData>({
    name: '',
    color: '#1e40af',
    slopeRating: 113,
    courseRating: 72,
    totalYardage: 6500,
    holes: Array.from({ length: numHoles }, (_, i) => ({
      holeNumber: i + 1,
      par: DEFAULT_PARS[i] || 4,
      yardage: 350,
      handicapIndex: i + 1,
    })),
  });
  const [loading, setLoading] = useState(false);

  const updateHole = (index: number, field: keyof HoleData, value: number) => {
    const newHoles = [...teeBox.holes];
    newHoles[index] = { ...newHoles[index], [field]: value };
    setTeeBox({ ...teeBox, holes: newHoles });
  };

  const handleSave = async () => {
    setLoading(true);
    await onSave(teeBox);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Tee Box Info */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Input
          label="Tee Name"
          value={teeBox.name}
          onChange={(e) => setTeeBox({ ...teeBox, name: e.target.value })}
          placeholder="e.g., Blue"
        />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-surface-200">Color</label>
          <input
            type="color"
            value={teeBox.color}
            onChange={(e) => setTeeBox({ ...teeBox, color: e.target.value })}
            className="h-10 w-full rounded-md cursor-pointer"
          />
        </div>
        <Input
          label="Slope Rating"
          type="number"
          value={teeBox.slopeRating}
          onChange={(e) => setTeeBox({ ...teeBox, slopeRating: Number(e.target.value) })}
          min={55}
          max={155}
        />
        <Input
          label="Course Rating"
          type="number"
          step={0.1}
          value={teeBox.courseRating}
          onChange={(e) => setTeeBox({ ...teeBox, courseRating: Number(e.target.value) })}
          min={55}
          max={85}
        />
      </div>

      {/* Holes Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-600 text-left text-xs text-surface-400">
              <th className="pb-2 pr-2">Hole</th>
              <th className="pb-2 pr-2">Par</th>
              <th className="pb-2 pr-2">Yards</th>
              <th className="pb-2">Hdcp Index</th>
            </tr>
          </thead>
          <tbody>
            {teeBox.holes.map((hole, i) => (
              <tr key={hole.holeNumber} className="border-b border-surface-700">
                <td className="py-1.5 pr-2 font-medium">{hole.holeNumber}</td>
                <td className="py-1.5 pr-2">
                  <select
                    value={hole.par}
                    onChange={(e) => updateHole(i, 'par', Number(e.target.value))}
                    className="w-16 rounded border border-surface-600 bg-surface-800 text-surface-50 px-1 py-0.5 text-sm"
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    value={hole.yardage}
                    onChange={(e) => updateHole(i, 'yardage', Number(e.target.value))}
                    className="w-20 rounded border border-surface-600 bg-surface-800 text-surface-50 px-2 py-0.5 text-sm"
                    min={50}
                    max={700}
                  />
                </td>
                <td className="py-1.5">
                  <input
                    type="number"
                    value={hole.handicapIndex}
                    onChange={(e) => updateHole(i, 'handicapIndex', Number(e.target.value))}
                    className="w-16 rounded border border-surface-600 bg-surface-800 text-surface-50 px-2 py-0.5 text-sm"
                    min={1}
                    max={18}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={handleSave} loading={loading}>
        Save Tee Box
      </Button>
    </div>
  );
}
