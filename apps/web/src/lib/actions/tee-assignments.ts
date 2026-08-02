'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  updatePlayerTeeSchema,
  bulkUpdatePlayerTeesSchema,
  calculateCourseHandicap,
} from '@golf/core';

export async function updatePlayerTee(roundId: string, playerId: string, teeBoxId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = updatePlayerTeeSchema.safeParse({ roundId, playerId, teeBoxId });
  if (!parsed.success) return { error: 'Invalid input' };

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, group_id, status, course_id')
    .eq('id', roundId)
    .single();

  if (roundError || !round) return { error: 'Round not found' };
  if (round.status === 'completed') return { error: 'Cannot change tees on a completed round' };

  const { data: member } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', round.group_id)
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') return { error: 'Only group admins can change tee assignments' };

  const { data: teeBox, error: teeBoxError } = await supabase
    .from('tee_boxes')
    .select('id, slope_rating, course_rating')
    .eq('id', teeBoxId)
    .eq('course_id', round.course_id)
    .single();

  if (teeBoxError || !teeBox) return { error: 'Tee box not found for this course' };

  const { data: player, error: playerError } = await supabase
    .from('round_players')
    .select('id, handicap_index_at_round, guest_handicap_index, user_id')
    .eq('round_id', roundId)
    .eq('id', playerId)
    .single();

  if (playerError || !player) return { error: 'Player not found in this round' };

  const handicapIndex = player.handicap_index_at_round ?? player.guest_handicap_index ?? 0;
  const courseHandicap = calculateCourseHandicap(handicapIndex, teeBox.slope_rating);

  const { error: updateError } = await supabase
    .from('round_players')
    .update({
      tee_box_id: teeBoxId,
      course_handicap: courseHandicap,
      playing_handicap: courseHandicap,
    })
    .eq('id', playerId);

  if (updateError) return { error: 'Failed to update tee assignment' };
  return { success: true, courseHandicap, playingHandicap: courseHandicap };
}

/**
 * Set a player's handicap index for THIS round and recompute their course
 * handicap from their tee. Lets the Commish fix a wrong/stale round handicap
 * (e.g. someone whose index changed after the round was created). Creator or
 * group admin only.
 */
export async function setRoundPlayerHandicap(
  roundId: string,
  playerId: string,
  handicapIndex: number | null
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (
    handicapIndex != null &&
    (Number.isNaN(handicapIndex) || handicapIndex < -10 || handicapIndex > 54)
  ) {
    return { error: 'Enter a valid handicap index (-10 to 54)' };
  }

  const { data: round } = await supabase
    .from('rounds')
    .select('id, group_id, status, created_by')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: member } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = member?.role === 'admin';
  }
  if (!authorized) return { error: 'Only the Commish can change handicaps' };

  const { data: player } = await supabase
    .from('round_players')
    .select('id, tee_box_id, user_id')
    .eq('round_id', roundId)
    .eq('id', playerId)
    .single();
  if (!player) return { error: 'Player not found in this round' };

  let courseHandicap: number | null = null;
  if (handicapIndex != null && player.tee_box_id) {
    const { data: teeBox } = await supabase
      .from('tee_boxes')
      .select('slope_rating')
      .eq('id', player.tee_box_id)
      .single();
    if (teeBox) courseHandicap = calculateCourseHandicap(handicapIndex, teeBox.slope_rating);
  }

  const { error } = await supabase
    .from('round_players')
    .update({
      handicap_index_at_round: handicapIndex,
      course_handicap: courseHandicap,
      playing_handicap: courseHandicap,
      ...(player.user_id ? {} : { guest_handicap_index: handicapIndex }),
    })
    .eq('id', playerId);
  if (error) {
    console.error('Set handicap error:', error);
    return { error: 'Failed to update handicap' };
  }
  return { success: true, courseHandicap };
}

export async function bulkUpdatePlayerTees(roundId: string, teeBoxId: string, playerIds?: string[]) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = bulkUpdatePlayerTeesSchema.safeParse({ roundId, teeBoxId, playerIds });
  if (!parsed.success) return { error: 'Invalid input' };

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, group_id, status, course_id')
    .eq('id', roundId)
    .single();

  if (roundError || !round) return { error: 'Round not found' };
  if (round.status === 'completed') return { error: 'Cannot change tees on a completed round' };

  const { data: member } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', round.group_id)
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') return { error: 'Only group admins can change tee assignments' };

  const { data: teeBox, error: teeBoxError } = await supabase
    .from('tee_boxes')
    .select('id, slope_rating, course_rating')
    .eq('id', teeBoxId)
    .eq('course_id', round.course_id)
    .single();

  if (teeBoxError || !teeBox) return { error: 'Tee box not found for this course' };

  let query = supabase
    .from('round_players')
    .select('id, handicap_index_at_round, guest_handicap_index')
    .eq('round_id', roundId);

  if (playerIds && playerIds.length > 0) {
    query = query.in('id', playerIds);
  }

  const { data: roundPlayers, error: playersError } = await query;
  if (playersError || !roundPlayers) return { error: 'Failed to fetch players' };

  let updatedCount = 0;
  for (const player of roundPlayers) {
    const handicapIndex = player.handicap_index_at_round ?? player.guest_handicap_index ?? 0;
    const courseHandicap = calculateCourseHandicap(handicapIndex, teeBox.slope_rating);

    const { error: updateError } = await supabase
      .from('round_players')
      .update({
        tee_box_id: teeBoxId,
        course_handicap: courseHandicap,
        playing_handicap: courseHandicap,
      })
      .eq('id', player.id);

    if (!updateError) updatedCount++;
  }

  await supabase
    .from('rounds')
    .update({ tee_box_id: teeBoxId })
    .eq('id', roundId);

  return { success: true, updatedCount };
}
