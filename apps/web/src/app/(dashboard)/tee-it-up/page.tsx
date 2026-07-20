import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';
import { getRecentCourses } from '@/lib/actions/courses';
import TeeItUpView from './tee-it-up-view';

export const metadata = {
  title: 'Tee It Up Now | Golf App',
};

export default async function TeeItUpPage() {
  // Type A lands in the Play experience, so it requires both flags.
  if (!(featureFlags.teeItUp && featureFlags.playExperience)) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [recentCourses, coursesRes, teeBoxesRes, profileRes] = await Promise.all([
    getRecentCourses(),
    supabase
      .from('courses')
      .select('id, name, city, state')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('tee_boxes')
      .select('id, name, color, tier, slope_rating, course_rating, course_id'),
    supabase.from('profiles').select('default_tee_tier').eq('id', user.id).single(),
  ]);

  return (
    <TeeItUpView
      userId={user.id}
      recentCourses={recentCourses}
      courses={(coursesRes.data as any[]) ?? []}
      teeBoxes={(teeBoxesRes.data as any[]) ?? []}
      defaultTeeTier={(profileRes.data as any)?.default_tee_tier ?? null}
    />
  );
}
