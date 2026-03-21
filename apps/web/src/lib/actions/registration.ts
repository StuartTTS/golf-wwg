'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { closeRegistrationSchema, reopenRegistrationSchema } from '@golf/core';

export async function closeRegistration(roundId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = closeRegistrationSchema.safeParse({ roundId });
  if (!parsed.success) return { error: 'Invalid input' };

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, group_id, status, registration_status')
    .eq('id', roundId)
    .single();

  if (roundError || !round) return { error: 'Round not found' };
  if (round.status !== 'upcoming') return { error: 'Can only close registration for upcoming rounds' };
  if (round.registration_status === 'closed') return { error: 'Registration is already closed' };

  const { data: member } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', round.group_id)
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') return { error: 'Only group admins can close registration' };

  const { count } = await supabase
    .from('round_players')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)
    .in('status', ['registered', 'confirmed', 'playing']);

  if (!count || count === 0) return { error: 'Cannot close registration with no registered players' };

  const { error: updateError } = await supabase
    .from('rounds')
    .update({ registration_status: 'closed' })
    .eq('id', roundId);

  if (updateError) return { error: 'Failed to close registration' };
  return { success: true };
}

export async function reopenRegistration(roundId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = reopenRegistrationSchema.safeParse({ roundId });
  if (!parsed.success) return { error: 'Invalid input' };

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, group_id, registration_status')
    .eq('id', roundId)
    .single();

  if (roundError || !round) return { error: 'Round not found' };
  if (round.registration_status === 'open') return { error: 'Registration is already open' };

  const { data: member } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', round.group_id)
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') return { error: 'Only group admins can reopen registration' };

  const { error: updateError } = await supabase
    .from('rounds')
    .update({ registration_status: 'open' })
    .eq('id', roundId);

  if (updateError) return { error: 'Failed to reopen registration' };
  return { success: true };
}
