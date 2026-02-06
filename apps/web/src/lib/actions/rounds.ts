'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createRoundSchema } from '@golf/core';

export async function createRound(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createRoundSchema.safeParse({
    groupId: formData.get('groupId'),
    courseId: formData.get('courseId'),
    teeBoxId: formData.get('teeBoxId'),
    roundDate: formData.get('roundDate'),
    teeTime: formData.get('teeTime') || undefined,
    scoringMode: formData.get('scoringMode'),
    scorekeeperId: formData.get('scorekeeperId') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { data: round, error } = await supabase
    .from('rounds')
    .insert({
      group_id: parsed.data.groupId,
      course_id: parsed.data.courseId,
      tee_box_id: parsed.data.teeBoxId,
      round_date: parsed.data.roundDate,
      tee_time: parsed.data.teeTime ?? null,
      status: 'upcoming',
      scoring_mode: parsed.data.scoringMode,
      scorekeeper_id: parsed.data.scorekeeperId ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Add creator as a player
  await supabase.from('round_players').insert({
    round_id: round.id,
    user_id: user.id,
    tee_box_id: parsed.data.teeBoxId,
    status: 'registered',
  });

  return { success: true, roundId: round.id };
}

export async function addPlayerToRound(roundId: string, userId: string, teeBoxId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Get player's current handicap
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_handicap_index')
    .eq('id', userId)
    .single();

  // Get tee box info for course handicap calculation
  const { data: teeBox } = await supabase
    .from('tee_boxes')
    .select('slope_rating, course_rating')
    .eq('id', teeBoxId)
    .single();

  let courseHandicap: number | null = null;
  if (profile?.current_handicap_index && teeBox) {
    courseHandicap = Math.round(
      profile.current_handicap_index * (teeBox.slope_rating / 113)
    );
  }

  const { error } = await supabase.from('round_players').insert({
    round_id: roundId,
    user_id: userId,
    tee_box_id: teeBoxId,
    handicap_index_at_round: profile?.current_handicap_index ?? null,
    course_handicap: courseHandicap,
    playing_handicap: courseHandicap, // Will be adjusted per game format
    status: 'registered',
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function removePlayerFromRound(roundId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('round_players')
    .delete()
    .eq('round_id', roundId)
    .eq('user_id', userId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function startRound(roundId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('rounds')
    .update({ status: 'in_progress' })
    .eq('id', roundId);

  if (error) return { error: error.message };

  // Update all registered players to 'playing'
  await supabase
    .from('round_players')
    .update({ status: 'playing' })
    .eq('round_id', roundId)
    .in('status', ['registered', 'confirmed']);

  return { success: true };
}

export async function completeRound(roundId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('rounds')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', roundId);

  if (error) return { error: error.message };

  // Update all playing players to 'completed'
  await supabase
    .from('round_players')
    .update({ status: 'completed' })
    .eq('round_id', roundId)
    .eq('status', 'playing');

  return { success: true };
}
