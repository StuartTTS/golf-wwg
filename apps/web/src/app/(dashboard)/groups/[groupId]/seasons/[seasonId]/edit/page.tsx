'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/providers/supabase-provider';
import { updateSeason, deleteSeason } from '@/lib/actions/seasons';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
} from '@/components/ui';

interface EditSeasonPageProps {
  params: Promise<{ groupId: string; seasonId: string }>;
}

export default function EditSeasonPage({ params }: EditSeasonPageProps) {
  const router = useRouter();
  const { supabase } = useSupabase();

  const [groupId, setGroupId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve params
  useEffect(() => {
    params.then(({ groupId: gId, seasonId: sId }) => {
      setGroupId(gId);
      setSeasonId(sId);
    });
  }, [params]);

  // Fetch season details
  useEffect(() => {
    if (!seasonId) return;
    async function fetchSeason() {
      const { data: season, error: seasonError } = await supabase
        .from('seasons')
        .select('id, name, start_date, end_date, is_active')
        .eq('id', seasonId)
        .single();

      if (seasonError || !season) {
        setError('Failed to load season.');
        setIsLoading(false);
        return;
      }

      setName(season.name);
      setStartDate(season.start_date);
      setEndDate(season.end_date);
      setIsActive(season.is_active);
      setIsLoading(false);
    }
    fetchSeason();
  }, [seasonId, supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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
      formData.set('name', name.trim());
      formData.set('startDate', startDate);
      formData.set('endDate', endDate);
      formData.set('isActive', isActive.toString());

      const result = await updateSeason(seasonId, formData);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Season updated successfully.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteSeason(seasonId);

      if (result.error) {
        setError(result.error);
        setIsDeleting(false);
        return;
      }

      router.push(`/groups/${groupId}/seasons`);
    } catch {
      setError('Failed to delete season.');
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-4 w-24 bg-surface-600 rounded animate-pulse mb-4" />
          <div className="h-8 w-48 bg-surface-600 rounded animate-pulse" />
        </div>
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="h-6 w-32 bg-surface-600 rounded animate-pulse" />
          </CardHeader>
          <div className="px-6 pb-6 space-y-4">
            <div className="h-10 bg-surface-600 rounded animate-pulse" />
            <div className="h-10 bg-surface-600 rounded animate-pulse" />
            <div className="h-10 bg-surface-600 rounded animate-pulse" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href={`/groups/${groupId}/seasons/${seasonId}`}
          className="text-sm text-surface-300 hover:text-surface-100 mb-2 inline-block"
        >
          &larr; Back to Season
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">
          Edit Season
        </h1>
        <p className="mt-1 text-sm text-surface-300">
          Update season details or deactivate the season.
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="rounded-md bg-golf-900/30 p-4 text-sm text-golf-600">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-900/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Edit Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Season Details</CardTitle>
          <CardDescription>
            Update the season name, dates, and active status.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSave} className="px-6 pb-6 space-y-5">
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

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            <label htmlFor="isActive" className="text-sm text-surface-100">
              Season is active
            </label>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className="max-w-2xl border-red-200">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>

        <div className="px-6 pb-6">
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-surface-50">
                  Delete this season
                </p>
                <p className="text-xs text-surface-300">
                  Once deleted, all season data will be permanently removed. Game
                  and round data will remain intact.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="text-red-400 border-red-300 hover:bg-red-900/30"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Season
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-red-200 bg-red-900/30 p-4">
              <p className="text-sm text-red-400">
                Are you sure you want to delete the season{' '}
                <strong>{name}</strong>? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Season'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
