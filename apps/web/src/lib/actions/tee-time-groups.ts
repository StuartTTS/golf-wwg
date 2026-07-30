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

  // Delegates to the save_tee_time_groups RPC, which authorizes (group admin),
  // clears, and rebuilds atomically in one transaction — a mid-save failure can
  // no longer leave the round with its foursomes wiped. The RPC also resolves
  // player ids safely (no interpolated PostgREST filter).
  // Cast: the RPC is defined in migration 00031 and not yet in the generated
  // database types. Regenerate types (npx supabase gen types) to remove this.
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ error: { message: string } | null }>)('save_tee_time_groups', {
    p_round_id: roundId,
    p_groups: groups,
  });

  if (error) {
    console.error('Save tee time groups error:', error);
    return { error: error.message };
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
