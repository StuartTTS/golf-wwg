'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSeason } from '@/lib/actions/seasons';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
} from '@/components/ui';

interface NewSeasonPageProps {
  params: Promise<{ groupId: string }>;
}

export default function NewSeasonPage({ params }: NewSeasonPageProps) {
  const router = useRouter();
  const [groupId, setGroupId] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    params.then(({ groupId: gId }) => setGroupId(gId));
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !startDate || !endDate) {
      setError('All fields are required.');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after start date.');
      return;
    }

    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.set('groupId', groupId);
      formData.set('name', name.trim());
      formData.set('startDate', startDate);
      formData.set('endDate', endDate);

      const result = await createSeason(formData);

      if (result.error) {
        setError(result.error);
        setIsSaving(false);
        return;
      }

      router.push(`/groups/${groupId}/seasons/${result.seasonId}`);
    } catch {
      setError('An unexpected error occurred.');
      setIsSaving(false);
    }
  }

  if (!groupId) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-4 w-24 bg-surface-600 rounded animate-pulse mb-4" />
          <div className="h-8 w-48 bg-surface-600 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href={`/groups/${groupId}/seasons`}
          className="text-sm text-surface-300 hover:text-surface-100 mb-2 inline-block"
        >
          &larr; Back to Seasons
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">
          New Season
        </h1>
        <p className="mt-1 text-sm text-surface-300">
          Create a new season to track points and standings.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-900/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create Season Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Season Details</CardTitle>
          <CardDescription>
            Set a name and date range for the season. Points are awarded based on
            game results within this date range.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
          {/* Season Name */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-surface-100"
            >
              Season Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              placeholder="e.g. Spring 2026"
              maxLength={100}
              required
            />
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-surface-100"
            >
              Start Date <span className="text-red-500">*</span>
            </label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setStartDate(e.target.value)
              }
              required
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <label
              htmlFor="endDate"
              className="block text-sm font-medium text-surface-100"
            >
              End Date <span className="text-red-500">*</span>
            </label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEndDate(e.target.value)
              }
              required
            />
          </div>

          {/* Points Config Info */}
          <div className="bg-surface-700 rounded-lg p-4">
            <p className="text-sm font-medium text-surface-100 mb-1">
              Default Points Configuration
            </p>
            <p className="text-xs text-surface-300">
              1st Place: 3 pts &middot; 2nd Place: 2 pts &middot; 3rd Place: 1 pt
            </p>
            <p className="text-xs text-surface-400 mt-1">
              Points are awarded based on finalized game rankings within each round.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Link href={`/groups/${groupId}/seasons`} className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving ? 'Creating...' : 'Create Season'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
