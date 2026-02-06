import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Course {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  num_holes: number;
  tee_boxes: {
    id: string;
    name: string;
    course_rating: number;
    slope_rating: number;
  }[];
}

export default async function CoursesPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Please sign in to view courses.</p>
      </div>
    );
  }

  const { data: courses, error } = await supabase
    .from('courses')
    .select(`
      id,
      name,
      city,
      state,
      num_holes,
      tee_boxes (
        id,
        name,
        course_rating,
        slope_rating
      )
    `)
    .eq('created_by', user.id)
    .order('name');

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-red-500">Failed to load courses: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-sm text-gray-500">
            {courses?.length ?? 0} courses available
          </p>
        </div>
        <Link href="/courses/new">
          <Button>
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Course
          </Button>
        </Link>
      </div>

      {/* Course list */}
      {(!courses || courses.length === 0) ? (
        <Card>
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 mx-auto flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11m16-11v11"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No courses yet
            </h3>
            <p className="text-gray-500 mb-4">
              Add your home course to get started
            </p>
            <Link href="/courses/new">
              <Button>Add Your First Course</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course: Course) => (
            <Link key={course.id} href={`/courses/${course.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{course.name}</CardTitle>
                      {(course.city || course.state) && (
                        <CardDescription className="mt-1">
                          {[course.city, course.state]
                            .filter(Boolean)
                            .join(', ')}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {course.num_holes} holes
                    </Badge>
                  </div>

                  {/* Tee boxes preview */}
                  {course.tee_boxes && course.tee_boxes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {course.tee_boxes.map((tee) => (
                        <div
                          key={tee.id}
                          className="text-xs bg-gray-100 rounded-md px-2 py-1"
                        >
                          <span className="font-medium text-gray-700">
                            {tee.name}
                          </span>
                          <span className="text-gray-500 ml-1">
                            {tee.course_rating}/{tee.slope_rating}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
