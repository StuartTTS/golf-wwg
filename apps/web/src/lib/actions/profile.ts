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
