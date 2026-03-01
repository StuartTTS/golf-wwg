'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

interface TeeTimeGroupInput {
  name: string;
  teeTime?: string | null;
  playerIds: string[];
}

export async function saveTeeTimeGroups(
  roundId: string,
  groups: TeeTimeGroupInput[]
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Fetch round to get group_id
  const { data: round } = await supabase
    .from('rounds')
    .select('id, group_id')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  // Verify caller is group admin
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', round.group_id)
    .eq('user_id', user.id)
    .single();
  if (!membership || membership.role !== 'admin') {
    return { error: 'Not authorized' };
  }

  // Delete existing tee time groups for this round (cascade clears FK on round_players)
  // First clear all round_players references
  await supabase
    .from('round_players')
    .update({ tee_time_group_id: null })
    .eq('round_id', roundId);

  // Delete old groups
  await supabase
    .from('tee_time_groups')
    .delete()
    .eq('round_id', roundId);

  // Create new groups and assign players
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (group.playerIds.length === 0) continue;

    const { data: newGroup, error: groupError } = await supabase
      .from('tee_time_groups')
      .insert({
        round_id: roundId,
        name: group.name,
        tee_time: group.teeTime || null,
        sort_order: i,
      })
      .select('id')
      .single();

    if (groupError || !newGroup) {
      return { error: groupError?.message ?? 'Failed to create group' };
    }

    // Assign players to this group
    for (const playerId of group.playerIds) {
      // playerId could be a user_id or a round_player id (for guests)
      const { error: updateError } = await supabase
        .from('round_players')
        .update({ tee_time_group_id: newGroup.id })
        .eq('round_id', roundId)
        .or(`user_id.eq.${playerId},id.eq.${playerId}`);

      if (updateError) {
        return { error: updateError.message };
      }
    }
  }

  return { success: true };
}

export async function clearTeeTimeGroups(roundId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Fetch round to get group_id
  const { data: round } = await supabase
    .from('rounds')
    .select('id, group_id')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  // Verify caller is group admin
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', round.group_id)
    .eq('user_id', user.id)
    .single();
  if (!membership || membership.role !== 'admin') {
    return { error: 'Not authorized' };
  }

  // Clear all round_players references first
  await supabase
    .from('round_players')
    .update({ tee_time_group_id: null })
    .eq('round_id', roundId);

  // Delete all tee time groups
  await supabase
    .from('tee_time_groups')
    .delete()
    .eq('round_id', roundId);

  return { success: true };
}
