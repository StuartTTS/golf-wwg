import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';
import { getRecentCourses } from '@/lib/actions/courses';
import { getRoster } from '@/lib/actions/roster';
import { getRosterGroups } from '@/lib/actions/roster-groups';
import GameTimeView from './game-time-view';

export const metadata = { title: 'Game Time | Golf App' };

export default async function GameTimePage() {
  // Game Time lands players in the Play experience and pulls from the roster.
  if (!(featureFlags.gameTime && featureFlags.playExperience && featureFlags.roster)) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [recentCourses, coursesRes, teeBoxesRes, profileRes, roster, groups] = await Promise.all([
    getRecentCourses(),
    supabase.from('courses').select('id, name, city, state').is('deleted_at', null).order('name'),
    supabase.from('tee_boxes').select('id, name, color, tier, slope_rating, course_rating, course_id'),
    supabase.from('profiles').select('default_tee_tier').eq('id', user.id).single(),
    getRoster(),
    getRosterGroups(),
  ]);

  return (
    <GameTimeView
      recentCourses={recentCourses}
      courses={(coursesRes.data as any[]) ?? []}
      teeBoxes={(teeBoxesRes.data as any[]) ?? []}
      defaultTeeTier={(profileRes.data as any)?.default_tee_tier ?? null}
      initialRoster={roster}
      groups={groups}
    />
  );
}
