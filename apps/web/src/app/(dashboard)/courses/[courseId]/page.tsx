import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HoleInfo {
  hole_number: number;
  par: number;
  yardage: number | null;
  handicap_index: number;
}

interface TeeBoxWithHoles {
  id: string;
  name: string;
  color: string | null;
  course_rating: number;
  slope_rating: number;
  total_yardage: number | null;
  holes: HoleInfo[];
}

interface CourseDetail {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  num_holes: number;
  created_by: string;
  tee_boxes: TeeBoxWithHoles[];
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { courseId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: course, error } = await supabase
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
    .single();

  if (error || !course) {
    notFound();
  }

  const typedCourse = course as unknown as CourseDetail;
  const isOwner = user?.id === typedCourse.created_by;

  // Sort holes by hole_number within each tee box
  typedCourse.tee_boxes.forEach((tb) => {
    tb.holes.sort((a, b) => a.hole_number - b.hole_number);
  });

  const primaryTee = typedCourse.tee_boxes[0];
  const totalPar = primaryTee
    ? primaryTee.holes.reduce((sum, h) => sum + h.par, 0)
    : 0;
  const frontNinePar = primaryTee
    ? primaryTee.holes
        .filter((h) => h.hole_number <= 9)
        .reduce((sum, h) => sum + h.par, 0)
    : 0;
  const backNinePar = primaryTee
    ? primaryTee.holes
        .filter((h) => h.hole_number > 9)
        .reduce((sum, h) => sum + h.par, 0)
    : 0;

  const getTeeColorClass = (color: string | null) => {
    switch (color?.toLowerCase()) {
      case 'black':
        return 'bg-surface-900 text-white';
      case 'blue':
        return 'bg-blue-600 text-white';
      case 'white':
        return 'bg-surface-800 text-surface-50 border border-surface-500';
      case 'gold':
        return 'bg-yellow-500 text-white';
      case 'green':
        return 'bg-golf-600 text-white';
      case 'red':
        return 'bg-red-600 text-white';
      case 'silver':
        return 'bg-gray-400 text-white';
      case 'copper':
        return 'bg-amber-700 text-white';
      default:
        return 'bg-surface-600 text-surface-100';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/courses"
            className="text-sm text-surface-300 hover:text-surface-100 flex items-center gap-1 mb-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Courses
          </Link>
          <h1 className="text-2xl font-bold text-surface-50">
            {typedCourse.name}
          </h1>
          {(typedCourse.city || typedCourse.state) && (
            <p className="text-surface-300 mt-1">
              {[typedCourse.city, typedCourse.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{typedCourse.num_holes} holes</Badge>
          {isOwner && (
            <Link href={`/courses/${courseId}/edit`}>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Course stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-surface-300 uppercase tracking-wide">
              Total Par
            </p>
            <p className="text-3xl font-bold text-surface-50 mt-1">{totalPar}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-surface-300 uppercase tracking-wide">
              Front 9
            </p>
            <p className="text-3xl font-bold text-surface-50 mt-1">
              {frontNinePar}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-surface-300 uppercase tracking-wide">
              Back 9
            </p>
            <p className="text-3xl font-bold text-surface-50 mt-1">
              {backNinePar || '-'}
            </p>
          </div>
        </Card>
      </div>

      {/* Tee Boxes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tee Boxes</CardTitle>
          <CardDescription>
            Available tee boxes with ratings and slopes
          </CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-500">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-surface-300">
                    Tee
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-surface-300">
                    Rating
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-surface-300">
                    Slope
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-surface-300">
                    Yardage
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-surface-300">
                    Par
                  </th>
                </tr>
              </thead>
              <tbody>
                {typedCourse.tee_boxes.map((tee) => {
                  const teePar = tee.holes.reduce((sum, h) => sum + h.par, 0);
                  const totalYardage = tee.holes.reduce(
                    (sum, h) => sum + (h.yardage ?? 0),
                    0
                  );

                  return (
                    <tr key={tee.id} className="border-b border-surface-600">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full ${getTeeColorClass(tee.color)}`}
                          />
                          <span className="font-medium text-surface-50">
                            {tee.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-surface-100">
                        {tee.course_rating}
                      </td>
                      <td className="py-3 px-3 text-center text-surface-100">
                        {tee.slope_rating}
                      </td>
                      <td className="py-3 px-3 text-center text-surface-100">
                        {(tee.total_yardage ?? totalYardage) || '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-surface-50">
                        {teePar}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Hole-by-hole details */}
      {primaryTee && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hole Details</CardTitle>
            <CardDescription>
              Showing data for {primaryTee.name} tees
            </CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-surface-500">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-surface-300">
                      Hole
                    </th>
                    {primaryTee.holes.map((h) => (
                      <th
                        key={h.hole_number}
                        className={`
                          text-center py-2 px-2 text-xs font-semibold text-surface-300 min-w-[2.5rem]
                          ${h.hole_number === 10 ? 'border-l-2 border-surface-500' : ''}
                        `}
                      >
                        {h.hole_number}
                      </th>
                    ))}
                    {typedCourse.num_holes === 18 && (
                      <>
                        <th className="text-center py-2 px-2 text-xs font-bold text-surface-100 bg-surface-700">
                          OUT
                        </th>
                        <th className="text-center py-2 px-2 text-xs font-bold text-surface-100 bg-surface-700">
                          IN
                        </th>
                      </>
                    )}
                    <th className="text-center py-2 px-2 text-xs font-bold text-surface-50 bg-surface-700">
                      TOT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Par row */}
                  <tr className="border-b border-surface-500 bg-surface-700">
                    <td className="py-2 px-2 text-xs font-semibold text-surface-300">
                      Par
                    </td>
                    {primaryTee.holes.map((h) => (
                      <td
                        key={h.hole_number}
                        className={`
                          text-center py-2 px-2 text-xs font-medium text-surface-100
                          ${h.hole_number === 10 ? 'border-l-2 border-surface-500' : ''}
                        `}
                      >
                        {h.par}
                      </td>
                    ))}
                    {typedCourse.num_holes === 18 && (
                      <>
                        <td className="text-center py-2 px-2 text-xs font-bold text-surface-100 bg-surface-700">
                          {frontNinePar}
                        </td>
                        <td className="text-center py-2 px-2 text-xs font-bold text-surface-100 bg-surface-700">
                          {backNinePar}
                        </td>
                      </>
                    )}
                    <td className="text-center py-2 px-2 text-xs font-bold text-surface-50 bg-surface-600">
                      {totalPar}
                    </td>
                  </tr>

                  {/* Yardage row */}
                  <tr className="border-b border-surface-500">
                    <td className="py-2 px-2 text-xs font-semibold text-surface-300">
                      Yds
                    </td>
                    {primaryTee.holes.map((h) => (
                      <td
                        key={h.hole_number}
                        className={`
                          text-center py-2 px-2 text-xs text-surface-200
                          ${h.hole_number === 10 ? 'border-l-2 border-surface-500' : ''}
                        `}
                      >
                        {h.yardage ?? '-'}
                      </td>
                    ))}
                    {typedCourse.num_holes === 18 && (
                      <>
                        <td className="text-center py-2 px-2 text-xs font-bold text-surface-200 bg-surface-700">
                          {primaryTee.holes
                            .filter((h) => h.hole_number <= 9)
                            .reduce((s, h) => s + (h.yardage ?? 0), 0) || '-'}
                        </td>
                        <td className="text-center py-2 px-2 text-xs font-bold text-surface-200 bg-surface-700">
                          {primaryTee.holes
                            .filter((h) => h.hole_number > 9)
                            .reduce((s, h) => s + (h.yardage ?? 0), 0) || '-'}
                        </td>
                      </>
                    )}
                    <td className="text-center py-2 px-2 text-xs font-bold text-surface-100 bg-surface-700">
                      {primaryTee.holes.reduce(
                        (s, h) => s + (h.yardage ?? 0),
                        0
                      ) || '-'}
                    </td>
                  </tr>

                  {/* Stroke Index row */}
                  <tr className="border-b border-surface-600">
                    <td className="py-2 px-2 text-xs font-semibold text-surface-300">
                      SI
                    </td>
                    {primaryTee.holes.map((h) => (
                      <td
                        key={h.hole_number}
                        className={`
                          text-center py-2 px-2 text-xs text-surface-300
                          ${h.hole_number === 10 ? 'border-l-2 border-surface-500' : ''}
                        `}
                      >
                        {h.handicap_index}
                      </td>
                    ))}
                    {typedCourse.num_holes === 18 && (
                      <>
                        <td className="bg-surface-700" />
                        <td className="bg-surface-700" />
                      </>
                    )}
                    <td className="bg-surface-700" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
