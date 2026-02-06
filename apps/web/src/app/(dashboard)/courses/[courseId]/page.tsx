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
  number: number;
  par: number;
  yardage: number | null;
  stroke_index: number;
}

interface TeeBoxWithHoles {
  id: string;
  name: string;
  color: string | null;
  rating: number;
  slope: number;
  yardage: number | null;
  holes: HoleInfo[];
}

interface CourseDetail {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  holes_count: number;
  is_public: boolean;
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
      holes_count,
      is_public,
      created_by,
      tee_boxes (
        id,
        name,
        color,
        rating,
        slope,
        yardage,
        holes (
          number,
          par,
          yardage,
          stroke_index
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

  // Sort holes by number within each tee box
  typedCourse.tee_boxes.forEach((tb) => {
    tb.holes.sort((a, b) => a.number - b.number);
  });

  const primaryTee = typedCourse.tee_boxes[0];
  const totalPar = primaryTee
    ? primaryTee.holes.reduce((sum, h) => sum + h.par, 0)
    : 0;
  const frontNinePar = primaryTee
    ? primaryTee.holes
        .filter((h) => h.number <= 9)
        .reduce((sum, h) => sum + h.par, 0)
    : 0;
  const backNinePar = primaryTee
    ? primaryTee.holes
        .filter((h) => h.number > 9)
        .reduce((sum, h) => sum + h.par, 0)
    : 0;

  const getTeeColorClass = (color: string | null) => {
    switch (color?.toLowerCase()) {
      case 'black':
        return 'bg-gray-900 text-white';
      case 'blue':
        return 'bg-blue-600 text-white';
      case 'white':
        return 'bg-dark-100 text-dark-900 border border-gray-300';
      case 'gold':
        return 'bg-yellow-500 text-white';
      case 'green':
        return 'bg-green-600 text-white';
      case 'red':
        return 'bg-red-600 text-white';
      case 'silver':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-gray-200 text-dark-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/courses"
            className="text-sm text-dark-600 hover:text-dark-800 flex items-center gap-1 mb-2"
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
          <h1 className="text-2xl font-bold text-dark-900">
            {typedCourse.name}
          </h1>
          {(typedCourse.city || typedCourse.state) && (
            <p className="text-dark-600 mt-1">
              {[typedCourse.city, typedCourse.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {typedCourse.is_public && <Badge variant="secondary">Public</Badge>}
          <Badge variant="secondary">{typedCourse.holes_count} holes</Badge>
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
            <p className="text-xs text-dark-600 uppercase tracking-wide">
              Total Par
            </p>
            <p className="text-3xl font-bold text-dark-900 mt-1">{totalPar}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-dark-600 uppercase tracking-wide">
              Front 9
            </p>
            <p className="text-3xl font-bold text-dark-900 mt-1">
              {frontNinePar}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-dark-600 uppercase tracking-wide">
              Back 9
            </p>
            <p className="text-3xl font-bold text-dark-900 mt-1">
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
                <tr className="border-b border-dark-300">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-dark-600">
                    Tee
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-dark-600">
                    Rating
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-dark-600">
                    Slope
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-dark-600">
                    Yardage
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-dark-600">
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
                    <tr key={tee.id} className="border-b border-gray-100">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full ${getTeeColorClass(tee.color)}`}
                          />
                          <span className="font-medium text-dark-900">
                            {tee.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-dark-800">
                        {tee.rating}
                      </td>
                      <td className="py-3 px-3 text-center text-dark-800">
                        {tee.slope}
                      </td>
                      <td className="py-3 px-3 text-center text-dark-800">
                        {(tee.yardage ?? totalYardage) || '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-dark-900">
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
                  <tr className="border-b border-dark-300">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-dark-600">
                      Hole
                    </th>
                    {primaryTee.holes.map((h) => (
                      <th
                        key={h.number}
                        className={`
                          text-center py-2 px-2 text-xs font-semibold text-dark-600 min-w-[2.5rem]
                          ${h.number === 10 ? 'border-l-2 border-gray-300' : ''}
                        `}
                      >
                        {h.number}
                      </th>
                    ))}
                    {typedCourse.holes_count === 18 && (
                      <>
                        <th className="text-center py-2 px-2 text-xs font-bold text-dark-800 bg-dark-50">
                          OUT
                        </th>
                        <th className="text-center py-2 px-2 text-xs font-bold text-dark-800 bg-dark-50">
                          IN
                        </th>
                      </>
                    )}
                    <th className="text-center py-2 px-2 text-xs font-bold text-dark-900 bg-gray-100">
                      TOT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Par row */}
                  <tr className="border-b border-dark-300 bg-dark-50">
                    <td className="py-2 px-2 text-xs font-semibold text-dark-600">
                      Par
                    </td>
                    {primaryTee.holes.map((h) => (
                      <td
                        key={h.number}
                        className={`
                          text-center py-2 px-2 text-xs font-medium text-dark-800
                          ${h.number === 10 ? 'border-l-2 border-gray-300' : ''}
                        `}
                      >
                        {h.par}
                      </td>
                    ))}
                    {typedCourse.holes_count === 18 && (
                      <>
                        <td className="text-center py-2 px-2 text-xs font-bold text-gray-800 bg-gray-100">
                          {frontNinePar}
                        </td>
                        <td className="text-center py-2 px-2 text-xs font-bold text-gray-800 bg-gray-100">
                          {backNinePar}
                        </td>
                      </>
                    )}
                    <td className="text-center py-2 px-2 text-xs font-bold text-dark-900 bg-gray-200">
                      {totalPar}
                    </td>
                  </tr>

                  {/* Yardage row */}
                  <tr className="border-b border-dark-300">
                    <td className="py-2 px-2 text-xs font-semibold text-dark-600">
                      Yds
                    </td>
                    {primaryTee.holes.map((h) => (
                      <td
                        key={h.number}
                        className={`
                          text-center py-2 px-2 text-xs text-dark-700
                          ${h.number === 10 ? 'border-l-2 border-gray-300' : ''}
                        `}
                      >
                        {h.yardage ?? '-'}
                      </td>
                    ))}
                    {typedCourse.holes_count === 18 && (
                      <>
                        <td className="text-center py-2 px-2 text-xs font-bold text-dark-700 bg-dark-50">
                          {primaryTee.holes
                            .filter((h) => h.number <= 9)
                            .reduce((s, h) => s + (h.yardage ?? 0), 0) || '-'}
                        </td>
                        <td className="text-center py-2 px-2 text-xs font-bold text-dark-700 bg-dark-50">
                          {primaryTee.holes
                            .filter((h) => h.number > 9)
                            .reduce((s, h) => s + (h.yardage ?? 0), 0) || '-'}
                        </td>
                      </>
                    )}
                    <td className="text-center py-2 px-2 text-xs font-bold text-dark-800 bg-gray-100">
                      {primaryTee.holes.reduce(
                        (s, h) => s + (h.yardage ?? 0),
                        0
                      ) || '-'}
                    </td>
                  </tr>

                  {/* Stroke Index row */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2 px-2 text-xs font-semibold text-dark-600">
                      SI
                    </td>
                    {primaryTee.holes.map((h) => (
                      <td
                        key={h.number}
                        className={`
                          text-center py-2 px-2 text-xs text-dark-600
                          ${h.number === 10 ? 'border-l-2 border-gray-300' : ''}
                        `}
                      >
                        {h.stroke_index}
                      </td>
                    ))}
                    {typedCourse.holes_count === 18 && (
                      <>
                        <td className="bg-dark-50" />
                        <td className="bg-dark-50" />
                      </>
                    )}
                    <td className="bg-gray-100" />
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
