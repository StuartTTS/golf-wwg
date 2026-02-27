'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { searchCoursesExternal, importCourse } from '@/lib/actions/courses';

export function CourseSearchPanel() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setResults([]);

    const res = await searchCoursesExternal(query);
    if (res.error) {
      setError(res.error);
    } else {
      setResults(res.courses ?? []);
    }
    setSearching(false);
  };

  const handleImport = async (externalId: number) => {
    setImporting(externalId);
    setError(null);

    const res = await importCourse(externalId);
    if (res.error) {
      setError(res.error);
      setImporting(null);
    } else if (res.courseId) {
      router.push(`/courses/${res.courseId}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by course name..."
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={searching || query.trim().length < 2}>
          {searching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-200 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-surface-300">{results.length} courses found</p>
          {results.map((course) => (
            <Card key={course.id} padding="none">
              <CardHeader className="flex flex-row items-center justify-between py-3 px-4 mb-0">
                <div>
                  <CardTitle className="text-base">
                    {course.course_name || course.club_name}
                  </CardTitle>
                  <CardDescription>
                    {[course.location?.city, course.location?.state].filter(Boolean).join(', ')}
                    {course.holes ? ` · ${course.holes} holes` : ''}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleImport(course.id)}
                  disabled={importing !== null}
                >
                  {importing === course.id ? 'Importing...' : 'Import'}
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {!searching && !error && results.length === 0 && query.length >= 2 && (
        <p className="text-sm text-surface-400 text-center py-4">
          No courses found. Try a different search term or create one manually.
        </p>
      )}
    </div>
  );
}
