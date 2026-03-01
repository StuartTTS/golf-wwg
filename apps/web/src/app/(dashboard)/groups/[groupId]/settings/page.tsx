'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/providers/supabase-provider';
import { updateGroup, deleteGroup } from '@/lib/actions/groups';
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
  club_id: string | null;
}

interface Club {
  id: string;
  name: string;
}

interface SettingsPageProps {
  params: Promise<{ groupId: string }>;
}

export default function GroupSettingsPage({ params }: SettingsPageProps) {
  const router = useRouter();
  const { supabase } = useSupabase();

  const [groupId, setGroupId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [homeClubId, setHomeClubId] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [defaultCourseId, setDefaultCourseId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve params
  useEffect(() => {
    params.then(({ groupId: gId }) => setGroupId(gId));
  }, [params]);

  // Fetch group details and clubs
  useEffect(() => {
    if (!groupId) return;
    async function fetchGroupAndClubs() {
      const [groupResult, clubsResult] = await Promise.all([
        supabase
          .from('groups')
          .select('id, name, description, default_course_id, home_club_id')
          .eq('id', groupId)
          .single(),
        supabase
          .from('clubs')
          .select('id, name')
          .order('name'),
      ]);

      if (groupResult.error || !groupResult.data) {
        setError('Failed to load group settings.');
        setIsLoading(false);
        return;
      }

      setName(groupResult.data.name);
      setDescription(groupResult.data.description ?? '');
      setDefaultCourseId(groupResult.data.default_course_id ?? '');
      setHomeClubId(groupResult.data.home_club_id ?? '');

      if (clubsResult.data) {
        setClubs(clubsResult.data);
      }

      setIsLoading(false);
    }
    fetchGroupAndClubs();
  }, [groupId, supabase]);

  // Fetch courses
  useEffect(() => {
    async function fetchCourses() {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, club_id')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (error) {
        console.error('Failed to load courses:', error);
        return;
      }
      if (data) setCourses(data);
    }
    fetchCourses();
  }, [supabase]);

  // Filter courses by selected home club
  const filteredCourses = homeClubId
    ? courses.filter((c) => c.club_id === homeClubId)
    : courses;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateGroup({
        groupId,
        name: name.trim(),
        description: description.trim() || undefined,
        defaultCourseId: defaultCourseId || undefined,
        homeClubId: homeClubId || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Group settings updated successfully.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirmText !== name) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteGroup(groupId);

      if (result.error) {
        setError(result.error);
        setIsDeleting(false);
        return;
      }

      router.push('/groups');
    } catch (err) {
      setError('Failed to delete group.');
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
            <div className="h-20 bg-surface-600 rounded animate-pulse" />
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
          href={`/groups/${groupId}`}
          className="text-sm text-surface-300 hover:text-surface-100 mb-2 inline-block"
        >
          &larr; Back to Group
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">
          Group Settings
        </h1>
        <p className="mt-1 text-sm text-surface-300">
          Manage settings for your group.
        </p>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex gap-4 border-b border-surface-500 pb-2">
        <Link
          href={`/groups/${groupId}`}
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
        >
          Overview
        </Link>
        <Link
          href={`/groups/${groupId}/members`}
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
        >
          Members
        </Link>
        <Link
          href={`/groups/${groupId}/rounds`}
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
        >
          Rounds
        </Link>
        <Link
          href={`/groups/${groupId}/leaderboard`}
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
        >
          Leaderboard
        </Link>
        <Link
          href={`/groups/${groupId}/seasons`}
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
        >
          Seasons
        </Link>
      </nav>

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

      {/* Edit Group Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Update your group name, description, and default course.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSave} className="px-6 pb-6 space-y-5">
          {/* Group Name */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-surface-100"
            >
              Group Name <span className="text-red-500">*</span>
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

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-surface-100"
            >
              Description
            </label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-surface-500 bg-surface-800 px-3 py-2 text-sm placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-golf-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Home Club */}
          <div className="space-y-2">
            <label
              htmlFor="homeClub"
              className="block text-sm font-medium text-surface-100"
            >
              Home Club
            </label>
            <SimpleSelect
              id="homeClub"
              value={homeClubId}
              onChange={(e) => {
                const newClubId = e.target.value;
                setHomeClubId(newClubId);
                // Clear default course if it doesn't belong to the new club
                if (newClubId && defaultCourseId) {
                  const currentCourse = courses.find((c) => c.id === defaultCourseId);
                  if (currentCourse && currentCourse.club_id !== newClubId) {
                    setDefaultCourseId('');
                  }
                }
              }}
              options={clubs.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="No home club"
            />
            <p className="text-xs text-surface-400">
              Tee preferences match by tier across club courses
            </p>
          </div>

          {/* Default Course */}
          <div className="space-y-2">
            <label
              htmlFor="defaultCourse"
              className="block text-sm font-medium text-surface-100"
            >
              Default Course
            </label>
            <SimpleSelect
              id="defaultCourse"
              value={defaultCourseId}
              onChange={(e) => setDefaultCourseId(e.target.value)}
              options={filteredCourses.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="No default course"
            />
            <p className="text-xs text-surface-300">
              Pre-selected when creating new rounds.
            </p>
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
                  Delete this group
                </p>
                <p className="text-xs text-surface-300">
                  Once deleted, all rounds and data associated with this group
                  will be permanently removed.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="text-red-400 border-red-300 hover:bg-red-900/30"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Group
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-red-200 bg-red-900/30 p-4">
              <p className="text-sm text-red-400">
                This action cannot be undone. This will permanently delete the
                group <strong>{name}</strong>, all its rounds, scores, and
                member associations.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor="deleteConfirm"
                  className="block text-sm font-medium text-red-400"
                >
                  Type <strong>{name}</strong> to confirm:
                </label>
                <Input
                  id="deleteConfirm"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDeleteConfirmText(e.target.value)
                  }
                  placeholder={name}
                  className="border-red-300"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== name || isDeleting}
                >
                  {isDeleting
                    ? 'Deleting...'
                    : 'I understand, delete this group'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
