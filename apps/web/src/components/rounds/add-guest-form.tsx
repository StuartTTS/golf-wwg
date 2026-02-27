'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addGuestToRound } from '@/lib/actions/rounds';

interface AddGuestFormProps {
  roundId: string;
  defaultTeeBoxId: string;
}

export function AddGuestForm({ roundId, defaultTeeBoxId }: AddGuestFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [handicap, setHandicap] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const res = await addGuestToRound(
      roundId,
      name.trim(),
      handicap ? parseFloat(handicap) : null,
      defaultTeeBoxId
    );

    if (res.error) {
      setError(res.error);
      setSaving(false);
    } else {
      setName('');
      setHandicap('');
      setSaving(false);
      router.refresh();
    }
  };

  return (
    <div className="space-y-3 p-4 bg-surface-700 rounded-lg">
      <h4 className="text-sm font-medium text-surface-100">Add Guest Player</h4>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Guest name"
          className="flex-1"
        />
        <Input
          type="number"
          step="0.1"
          value={handicap}
          onChange={(e) => setHandicap(e.target.value)}
          placeholder="HCP (optional)"
          className="w-28"
        />
        <Button onClick={handleSubmit} disabled={saving || !name.trim()} size="sm">
          {saving ? 'Adding...' : 'Add'}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
