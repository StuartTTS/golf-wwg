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
