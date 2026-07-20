'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { courseSchema, teeBoxSchema, holeSchema } from '@golf/core';

export async function createCourse(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = courseSchema.safeParse({
    name: formData.get('name'),
    city: formData.get('city') || undefined,
    state: formData.get('state') || undefined,
    country: formData.get('country') || 'US',
    numHoles: Number(formData.get('numHoles')) || 18,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      name: parsed.data.name,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      country: parsed.data.country,
      num_holes: parsed.data.numHoles,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true, courseId: course.id };
}

export async function updateCourse(courseId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('courses')
    .update({
      name: formData.get('name') as string,
      city: (formData.get('city') as string) || null,
      state: (formData.get('state') as string) || null,
      country: (formData.get('country') as string) || 'US',
      num_holes: Number(formData.get('numHoles')) || 18,
    })
    .eq('id', courseId)
    .eq('created_by', user.id);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}

export async function createTeeBox(courseId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: course } = await supabase
    .from('courses')
    .select('created_by')
    .eq('id', courseId)
    .single();
  if (!course || course.created_by !== user.id) {
    return { error: 'Not authorized' };
  }

  const parsed = teeBoxSchema.safeParse({
    name: formData.get('name'),
    color: formData.get('color') || undefined,
    slopeRating: Number(formData.get('slopeRating')),
    courseRating: Number(formData.get('courseRating')),
    totalYardage: formData.get('totalYardage') ? Number(formData.get('totalYardage')) : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { data: teeBox, error } = await supabase
    .from('tee_boxes')
    .insert({
      course_id: courseId,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      slope_rating: parsed.data.slopeRating,
      course_rating: parsed.data.courseRating,
      total_yardage: parsed.data.totalYardage ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true, teeBoxId: teeBox.id };
}

export async function createHoles(
  teeBoxId: string,
  holes: {
    holeNumber: number;
    par: number;
    yardage?: number;
    handicapIndex: number;
  }[]
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: teeBox } = await supabase
    .from('tee_boxes')
    .select('course_id, courses(created_by)')
    .eq('id', teeBoxId)
    .single();
  if (!teeBox) return { error: 'Tee box not found' };
  const course = (teeBox as any).courses;
  if (!course || course.created_by !== user.id) {
    return { error: 'Not authorized' };
  }

  for (const hole of holes) {
    const parsed = holeSchema.safeParse(hole);
    if (!parsed.success) {
      return { error: `Hole ${hole.holeNumber}: ${parsed.error.errors[0].message}` };
    }
  }

  const rows = holes.map((h) => ({
    tee_box_id: teeBoxId,
    hole_number: h.holeNumber,
    par: h.par,
    yardage: h.yardage ?? null,
    handicap_index: h.handicapIndex,
  }));

  const { error } = await supabase.from('holes').insert(rows);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}

export async function updateHoles(
  teeBoxId: string,
  holes: {
    holeNumber: number;
    par: number;
    yardage?: number;
    handicapIndex: number;
  }[]
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: teeBox } = await supabase
    .from('tee_boxes')
    .select('course_id, courses(created_by)')
    .eq('id', teeBoxId)
    .single();
  if (!teeBox) return { error: 'Tee box not found' };
  const course = (teeBox as any).courses;
  if (!course || course.created_by !== user.id) {
    return { error: 'Not authorized' };
  }

  // Delete existing and re-insert
  await supabase.from('holes').delete().eq('tee_box_id', teeBoxId);

  const rows = holes.map((h) => ({
    tee_box_id: teeBoxId,
    hole_number: h.holeNumber,
    par: h.par,
    yardage: h.yardage ?? null,
    handicap_index: h.handicapIndex,
  }));

  const { error } = await supabase.from('holes').insert(rows);
  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}

export async function searchCoursesExternal(query: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!query || query.trim().length < 2) {
    return { error: 'Search query must be at least 2 characters' };
  }

  try {
    const { searchCourses } = await import('@/lib/golf-course-api');
    const results = await searchCourses(query.trim());
    return { courses: results };
  } catch (err: any) {
    console.error('Course search error:', err);
    return { error: 'Failed to search courses. Please try again.' };
  }
}

export async function importCourse(externalId: number) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Check if already imported
  const { data: existing } = await supabase
    .from('courses')
    .select('id')
    .eq('external_id', String(externalId))
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    return { success: true, courseId: existing.id, alreadyExists: true };
  }

  try {
    const { getCourseDetail } = await import('@/lib/golf-course-api');
    const detail = await getCourseDetail(externalId);
    if (!detail) return { error: 'Course not found in database' };

    // Map common tee names to color values
    const teeNameToColor = (name: string): string | null => {
      switch (name.toLowerCase()) {
        case 'black': return 'black';
        case 'blue': return 'blue';
        case 'white': return 'white';
        case 'gold': return 'gold';
        case 'green': return 'green';
        case 'red': return 'red';
        case 'silver': return 'silver';
        case 'copper': return 'copper';
        default: return null;
      }
    };

    // Create course
    const courseName = detail.course_name || detail.club_name;
    // Flatten male + female tees, prefixing names to distinguish them
    const maleTees = (detail.tees?.male ?? []).map(t => ({
      ...t,
      tee_color: teeNameToColor(t.tee_name),
      tee_name: `${t.tee_name} (M)`,
    }));
    const femaleTees = (detail.tees?.female ?? []).map(t => ({
      ...t,
      tee_color: teeNameToColor(t.tee_name),
      tee_name: `${t.tee_name} (W)`,
    }));
    const allTees = [...maleTees, ...femaleTees];
    const numHoles = allTees[0]?.number_of_holes ?? 18;

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert({
        name: courseName,
        city: detail.location?.city ?? null,
        state: detail.location?.state ?? null,
        country: detail.location?.country ?? 'US',
        num_holes: numHoles,
        external_id: String(detail.id),
        source: 'golfcourseapi',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (courseError) throw courseError;

    // Create tee boxes and holes
    for (const tee of allTees) {
      const { data: teeBox, error: teeError } = await supabase
        .from('tee_boxes')
        .insert({
          course_id: course.id,
          name: tee.tee_name,
          color: tee.tee_color ?? null,
          course_rating: tee.course_rating ?? 72,
          slope_rating: tee.slope_rating ?? 113,
          total_yardage: tee.total_yards ?? null,
        })
        .select('id')
        .single();

      if (teeError) {
        console.error('Tee box insert error:', teeError);
        continue;
      }

      // Insert holes
      if (tee.holes && tee.holes.length > 0) {
        const holesInsert = tee.holes.map((h, idx) => ({
          tee_box_id: teeBox.id,
          hole_number: idx + 1,
          par: h.par ?? 4,
          yardage: h.yardage ?? null,
          handicap_index: h.handicap ?? (idx + 1),
        }));

        const { error: holesError } = await supabase
          .from('holes')
          .insert(holesInsert);

        if (holesError) {
          console.error('Holes insert error:', holesError);
        }
      }
    }

    return { success: true, courseId: course.id };
  } catch (err: any) {
    console.error('Course import error:', err);
    return { error: 'Failed to import course' };
  }
}

/**
 * Courses the current user has recently played (any round they're a player in),
 * most-recent first and de-duplicated. Powers the "Recently played" quick list
 * in the "Tee It Up Now" solo flow. See docs/phase1-type-a-spec.md.
 */
export async function getRecentCourses(limit = 6) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('round_players')
    .select('rounds!inner(course_id, round_date, courses(id, name, city, state))')
    .eq('user_id', user.id)
    .order('round_date', { referencedTable: 'rounds', ascending: false })
    .limit(40);

  if (error || !data) {
    if (error) console.error('Recent courses error:', error);
    return [];
  }

  // De-dupe by course_id, keeping the newest occurrence, cap to `limit`.
  const seen = new Set<string>();
  const out: { id: string; name: string; city: string | null; state: string | null }[] = [];
  for (const row of data as any[]) {
    const course = row.rounds?.courses;
    if (!course?.id || seen.has(course.id)) continue;
    seen.add(course.id);
    out.push({ id: course.id, name: course.name, city: course.city, state: course.state });
    if (out.length >= limit) break;
  }
  return out;
}
