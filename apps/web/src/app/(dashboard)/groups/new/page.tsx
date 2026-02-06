'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/providers/supabase-provider';
import { createGroup } from '@/lib/actions/groups';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Select,
} from '@/components/ui';

interface Course {
  id: string;
  name: string;
}

export default function CreateGroupPage() {
  const router = useRouter();
  const { supabase } = useSupabase();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultCourseId, setDefaultCourseId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCourses() {
      const { data } = await supabase
        .from('courses')
        .select('id, name')
        .order('name', { ascending: true });
      if (data) {
        setCourses(data);
      }
    }
    fetchCourses();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        defaultCourseId: defaultCourseId || undefined,
      });

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      router.push(`/groups/${result.groupId}`);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href="/groups"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Back to Groups
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Create a Group
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new golf group and invite your friends.
        </p>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Group Details</CardTitle>
          <CardDescription>
            Fill in the information below to create your group.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Group Name */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Group Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., Saturday Morning Crew"
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
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="What is this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Default Course */}
          <div className="space-y-2">
            <label
              htmlFor="defaultCourse"
              className="block text-sm font-medium text-gray-700"
            >
              Default Course
            </label>
            <Select
              id="defaultCourse"
              value={defaultCourseId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setDefaultCourseId(e.target.value)
              }
            >
              <option value="">Select a course (optional)</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-500">
              This will be the default course when creating rounds for this group.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Link href="/groups">
              <Button type="button" variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Group'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
