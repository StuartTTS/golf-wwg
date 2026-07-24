'use server';

// Persistent player roster (Phase 2 / Type B). Owner-scoped CRUD, add-to-round
// (reusing the guest/registered plumbing with a roster back-link), and
// recent-player suggestions. See docs/roster-design.md.

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rosterPlayerSchema } from '@golf/core';

export interface RosterEntry {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  linkedUserId: string | null;
  handicapIndex: number | null; // live for linked players, else the stored value
  notes: string | null;
}

/** The caller's roster, newest label order, with live handicaps for linked players. */
export async function getRoster(): Promise<RosterEntry[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('roster_players')
    .select(
      `id, display_name, email, phone, handicap_index, linked_user_id, notes,
       linked:profiles!roster_players_linked_user_id_fkey ( current_handicap_index )`
    )
    .eq('owner_id', user.id)
    .order('display_name');

  if (error) {
    console.error('Get roster error:', error);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email,
    phone: r.phone,
    linkedUserId: r.linked_user_id,
    handicapIndex: r.linked_user_id
      ? r.linked?.current_handicap_index ?? r.handicap_index ?? null
      : r.handicap_index ?? null,
    notes: r.notes,
  }));
}

export async function addRosterPlayer(input: {
  displayName: string;
  email?: string;
  phone?: string;
  handicapIndex?: number | null;
  linkedUserId?: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = rosterPlayerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { data, error } = await supabase
    .from('roster_players')
    .insert({
      owner_id: user.id,
      display_name: parsed.data.displayName,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      handicap_index: parsed.data.handicapIndex ?? null,
      linked_user_id: parsed.data.linkedUserId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      return { error: 'That player is already on your roster.' };
    }
    console.error('Add roster player error:', error);
    return { error: 'Could not add player to roster' };
  }
  return { success: true, rosterPlayerId: data.id };
}

export async function updateRosterPlayer(
  id: string,
  patch: {
    displayName?: string;
    email?: string | null;
    phone?: string | null;
    handicapIndex?: number | null;
  }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const update: Record<string, unknown> = {};
  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim();
    if (name.length < 2) return { error: 'Name must be at least 2 characters' };
    update.display_name = name;
  }
  if (patch.email !== undefined) update.email = patch.email || null;
  if (patch.phone !== undefined) update.phone = patch.phone || null;
  if (patch.handicapIndex !== undefined) update.handicap_index = patch.handicapIndex;
  if (Object.keys(update).length === 0) return { success: true };

  // RLS restricts this to the caller's own roster rows.
  const { error } = await supabase.from('roster_players').update(update).eq('id', id);
  if (error) {
    console.error('Update roster player error:', error);
    return { error: 'Could not update roster player' };
  }
  return { success: true };
}

export async function removeRosterPlayer(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase.from('roster_players').delete().eq('id', id);
  if (error) {
    console.error('Remove roster player error:', error);
    return { error: 'Could not remove roster player' };
  }
  return { success: true };
}

/**
 * Add a roster player to a round. Linked entries join as registered players;
 * unlinked entries join as guests. Either way the round_player is stamped with
 * roster_player_id for cross-round identity. Caller must be the round creator or
 * a group admin.
 */
export async function addRosterPlayerToRound(roundId: string, rosterPlayerId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Roster entry must be the caller's (RLS also enforces this).
  const { data: rp } = await supabase
    .from('roster_players')
    .select('id, display_name, handicap_index, linked_user_id, owner_id')
    .eq('id', rosterPlayerId)
    .single();
  if (!rp || rp.owner_id !== user.id) return { error: 'Roster player not found' };

  // Round + authorization + default tee box.
  const { data: round } = await supabase
    .from('rounds')
    .select('created_by, group_id, tee_box_id')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Not authorized' };

  const { data: teeBox } = await supabase
    .from('tee_boxes')
    .select('slope_rating')
    .eq('id', round.tee_box_id)
    .single();
  const slope = teeBox?.slope_rating ?? null;

  // Handicap: live from the profile for linked players, else the roster value.
  let hcpIndex: number | null = rp.handicap_index ?? null;
  if (rp.linked_user_id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('current_handicap_index')
      .eq('id', rp.linked_user_id)
      .single();
    hcpIndex = prof?.current_handicap_index ?? rp.handicap_index ?? null;
  }
  const courseHcp =
    hcpIndex != null && slope != null ? Math.round(hcpIndex * (slope / 113)) : null;

  const row: Record<string, unknown> = {
    round_id: roundId,
    tee_box_id: round.tee_box_id,
    handicap_index_at_round: hcpIndex,
    course_handicap: courseHcp,
    playing_handicap: courseHcp,
    status: 'registered',
    roster_player_id: rp.id,
    user_id: rp.linked_user_id ?? null,
  };
  if (!rp.linked_user_id) {
    row.guest_name = rp.display_name;
    row.guest_handicap_index = rp.handicap_index ?? null;
  }

  const { data: inserted, error } = await supabase
    .from('round_players')
    .insert(row as any)
    .select('id')
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      return { error: 'That player is already in this round.' };
    }
    console.error('Add roster player to round error:', error);
    return { error: 'Could not add player to round' };
  }
  return { success: true, roundPlayerId: inserted.id };
}

/**
 * Registered co-players from the caller's past rounds not already on their
 * roster — bootstraps an empty roster from history. Guest-only co-players aren't
 * suggested (no stable identity to key on).
 */
export async function suggestRecentPlayers(limit = 10) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: mine } = await supabase
    .from('round_players')
    .select('round_id')
    .eq('user_id', user.id);
  const roundIds = [...new Set((mine ?? []).map((r) => r.round_id))];
  if (roundIds.length === 0) return [];

  const [{ data: coPlayers }, { data: existing }] = await Promise.all([
    supabase
      .from('round_players')
      .select(
        `user_id, profiles:profiles!round_players_user_id_fkey ( id, display_name, current_handicap_index )`
      )
      .in('round_id', roundIds)
      .not('user_id', 'is', null)
      .neq('user_id', user.id),
    supabase
      .from('roster_players')
      .select('linked_user_id')
      .eq('owner_id', user.id)
      .not('linked_user_id', 'is', null),
  ]);

  const onRoster = new Set((existing ?? []).map((e: any) => e.linked_user_id));
  const seen = new Set<string>();
  const out: { userId: string; displayName: string; handicapIndex: number | null }[] = [];
  for (const cp of (coPlayers ?? []) as any[]) {
    const uid = cp.user_id as string | null;
    if (!uid || onRoster.has(uid) || seen.has(uid)) continue;
    seen.add(uid);
    out.push({
      userId: uid,
      displayName: cp.profiles?.display_name ?? 'Player',
      handicapIndex: cp.profiles?.current_handicap_index ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}
