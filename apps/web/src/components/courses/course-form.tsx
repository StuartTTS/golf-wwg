'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { SimpleSelect } from '@/components/ui/select';

interface CourseFormProps {
  initialData?: {
    name: string;
    city: string;
    state: string;
    country: string;
    numHoles: number;
  };
  onSubmit: (formData: FormData) => Promise<{ error?: string; success?: boolean; courseId?: string }>;
  submitLabel?: string;
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
].map((s) => ({ value: s, label: s }));

export function CourseForm({ initialData, onSubmit, submitLabel = 'Create Course' }: CourseFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const result = await onSubmit(formData);

    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="name"
        name="name"
        label="Course Name"
        defaultValue={initialData?.name}
        required
        placeholder="e.g., Pine Valley Golf Club"
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="city"
          name="city"
          label="City"
          defaultValue={initialData?.city}
          placeholder="City"
        />
        <SimpleSelect
          id="state"
          name="state"
          label="State"
          options={US_STATES}
          defaultValue={initialData?.state}
          placeholder="Select state"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="country"
          name="country"
          label="Country"
          defaultValue={initialData?.country || 'US'}
        />
        <SimpleSelect
          id="numHoles"
          name="numHoles"
          label="Number of Holes"
          options={[
            { value: '9', label: '9 holes' },
            { value: '18', label: '18 holes' },
            { value: '27', label: '27 holes' },
            { value: '36', label: '36 holes' },
          ]}
          defaultValue={String(initialData?.numHoles || 18)}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" loading={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}
