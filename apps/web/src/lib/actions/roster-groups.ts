'use server';

// Personal roster groups (folders over the roster). Owner-scoped CRUD + member
// management. Used to pre-fill game/cup setup. See docs/groups-as-roster-folders.md.

import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RosterGroup {
  id: string;
  name: string;
  memberIds: string[];
}

export async function getRosterGroups(): Promise<RosterGroup[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('roster_groups')
    .select('id, name, roster_group_members(roster_player_id)')
    .eq('owner_id', user.id)
    .order('name');

  if (error) {
    console.error('Get roster groups error:', error);
    return [];
  }
  return (data ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    memberIds: (g.roster_group_members ?? []).map((m: any) => m.roster_player_id),
  }));
}

export async function createRosterGroup(name: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const n = name.trim();
  if (n.length < 1) return { error: 'Enter a group name' };

  const { data, error } = await supabase
    .from('roster_groups')
    .insert({ owner_id: user.id, name: n })
    .select('id')
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      return { error: 'You already have a group with that name.' };
    }
    console.error('Create roster group error:', error);
    return { error: 'Could not create group' };
  }
  return { success: true, groupId: data.id };
}

export async function renameRosterGroup(id: string, name: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const n = name.trim();
  if (n.length < 1) return { error: 'Enter a group name' };

  const { error } = await supabase.from('roster_groups').update({ name: n }).eq('id', id);
  if (error) {
    if ((error as any).code === '23505') {
      return { error: 'You already have a group with that name.' };
    }
    console.error('Rename roster group error:', error);
    return { error: 'Could not rename group' };
  }
  return { success: true };
}

export async function deleteRosterGroup(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase.from('roster_groups').delete().eq('id', id);
  if (error) {
    console.error('Delete roster group error:', error);
    return { error: 'Could not delete group' };
  }
  return { success: true };
}

/** Replace a group's membership with the given roster player ids. */
export async function setRosterGroupMembers(groupId: string, rosterPlayerIds: string[]) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: g } = await supabase
    .from('roster_groups')
    .select('id, owner_id')
    .eq('id', groupId)
    .single();
  if (!g || g.owner_id !== user.id) return { error: 'Group not found' };

  const { error: delErr } = await supabase
    .from('roster_group_members')
    .delete()
    .eq('roster_group_id', groupId);
  if (delErr) {
    console.error('Clear roster group members error:', delErr);
    return { error: 'Could not update group' };
  }

  const uniq = [...new Set(rosterPlayerIds)];
  if (uniq.length > 0) {
    const rows = uniq.map((rid) => ({
      roster_group_id: groupId,
      roster_player_id: rid,
    }));
    const { error: insErr } = await supabase.from('roster_group_members').insert(rows);
    if (insErr) {
      console.error('Set roster group members error:', insErr);
      return { error: 'Could not update group' };
    }
  }
  return { success: true };
}
