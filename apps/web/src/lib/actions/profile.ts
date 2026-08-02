'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { joinProfileSchema, type JoinProfileInput } from '@golf/core';

/**
 * Save the profile a player fills in when joining a game by GameID: name +
 * email (identity / claim key), optional phone (contact), and handicap (net
 * scoring). Marks the profile complete so they clear the setup gate and land in
 * the round. See docs/gameid-join-roles.md.
 */
export async function saveJoinProfile(input: JoinProfileInput) {
  const parsed = joinProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Check your details' };
  }
  const { displayName, email, phone, handicapIndex } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      email,
      phone: phone || null,
      current_handicap_index: handicapIndex ?? null,
      profile_completed: true,
    })
    .eq('id', user.id);

  if (error) {
    console.error('Save join profile error:', error);
    return { error: 'Could not save your profile' };
  }

  // Mirror into auth metadata so the profile-completion middleware clears.
  await supabase.auth.updateUser({
    data: { display_name: displayName, profile_completed: true },
  });

  // Claim any roster entries others added for this email, and reconcile the
  // guest placeholders they created. Best-effort — never block the join on it.
  const { error: claimError } = await supabase.rpc('claim_roster_by_email');
  if (claimError) console.error('Roster claim error:', claimError);

  return { success: true };
}

/**
 * Join UX hint: given a round the caller just joined and a candidate email,
 * return the name of the unlinked guest spot in that round that this email would
 * link to (via claim_roster_by_email), or null. Lets the join screen reassure
 * the player that their scores will merge before they save. Best-effort.
 */
/**
 * Tie the current user to an existing unclaimed guest spot in a round they've
 * joined — merges that spot's game memberships + scores onto the user's real
 * card and links the roster entry. The email-independent way to claim your spot
 * when auto-matching didn't catch it. Auth + merge happen in claim_guest_spot.
 */
export async function claimGuestSpot(roundPlayerId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase.rpc('claim_guest_spot', {
    p_round_player_id: roundPlayerId,
  });
  if (error) {
    console.error('Claim guest spot error:', error);
    return { error: error.message };
  }
  return { success: true };
}

export async function previewJoinClaim(roundId: string, email: string) {
  const trimmed = email.trim();
  if (!roundId || trimmed.length < 3) return { matchName: null };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { matchName: null };

  const { data, error } = await supabase.rpc('preview_join_claim', {
    p_round_id: roundId,
    p_email: trimmed,
  });
  if (error) {
    console.error('Preview join claim error:', error);
    return { matchName: null };
  }
  return { matchName: (data as string | null) ?? null };
}
