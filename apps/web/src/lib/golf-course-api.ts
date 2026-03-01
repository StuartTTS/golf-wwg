const API_BASE = 'https://api.golfcourseapi.com/v1';

interface GolfCourseSearchResult {
  id: number;
  club_name: string;
  course_name: string;
  location: { city: string; state: string; country: string };
  holes: number;
}

interface GolfCourseTeeHole {
  par: number;
  yardage: number;
  handicap: number;
}

interface GolfCourseTee {
  tee_name: string;
  course_rating: number;
  slope_rating: number;
  total_yards: number;
  number_of_holes: number;
  par_total: number;
  holes: GolfCourseTeeHole[];
}

interface GolfCourseDetail {
  id: number;
  club_name: string;
  course_name: string;
  location: { city: string; state: string; country: string };
  tees: { male: GolfCourseTee[]; female: GolfCourseTee[] };
}

export type { GolfCourseSearchResult, GolfCourseDetail, GolfCourseTee, GolfCourseTeeHole };

function getApiKey(): string {
  const key = process.env.GOLF_COURSE_API_KEY;
  if (!key) throw new Error('GOLF_COURSE_API_KEY is not configured');
  return key;
}

export async function searchCourses(query: string): Promise<GolfCourseSearchResult[]> {
  const res = await fetch(`${API_BASE}/search?search_query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Key ${getApiKey()}` },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!res.ok) {
    console.error('GolfCourseAPI search error:', res.status, await res.text());
    throw new Error('Failed to search courses');
  }

  const data = await res.json();
  return data.courses ?? [];
}

export async function getCourseDetail(courseId: number): Promise<GolfCourseDetail | null> {
  const res = await fetch(`${API_BASE}/courses/${courseId}`, {
    headers: { Authorization: `Key ${getApiKey()}` },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    console.error('GolfCourseAPI detail error:', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return data.course ?? null;
}
