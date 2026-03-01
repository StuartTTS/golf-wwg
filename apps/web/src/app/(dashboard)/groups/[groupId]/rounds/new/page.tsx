import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import CreateRoundWizard from './create-round-wizard';

interface CreateRoundPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function CreateRoundPage({ params }: CreateRoundPageProps) {
  const { groupId } = await params;
  const supabase = await createServerSupabaseClient();

  // Fetch group info
  const { data: group } = await supabase
    .from('groups')
    .select('name, default_course_id')
    .eq('id', groupId)
    .single();

  if (!group) {
    notFound();
  }

  // Fetch all courses
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  // Fetch group members
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, profile:profiles(id, display_name, current_handicap_index, default_tee_tier)')
    .eq('group_id', groupId);

  // Pre-fetch all tee boxes for all courses so the wizard doesn't need
  // client-side authenticated queries (avoids RLS/session timing issues)
  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: allTeeBoxes } = courseIds.length > 0
    ? await supabase
        .from('tee_boxes')
        .select('id, name, color, course_rating, slope_rating, tier, course_id')
        .in('course_id', courseIds)
        .order('course_rating', { ascending: true })
    : { data: [] };

  return (
    <CreateRoundWizard
      groupId={groupId}
      groupName={group.name}
      defaultCourseId={group.default_course_id}
      courses={courses ?? []}
      members={(members as any) ?? []}
      allTeeBoxes={(allTeeBoxes as any) ?? []}
    />
  );
}
