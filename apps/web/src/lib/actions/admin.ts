'use server';

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

async function requireSiteAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' as const, supabase: null, user: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_site_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_site_admin) return { error: 'Not authorized' as const, supabase: null, user: null };

  return { error: null, supabase, user };
}

export async function toggleSiteAdmin(userId: string) {
  const { error, supabase, user } = await requireSiteAdmin();
  if (error) return { error };

  if (userId === user!.id) return { error: 'Cannot change your own admin status' };

  const { data: target } = await supabase!
    .from('profiles')
    .select('is_site_admin')
    .eq('id', userId)
    .single();

  if (!target) return { error: 'User not found' };

  const { error: updateError } = await supabase!
    .from('profiles')
    .update({ is_site_admin: !target.is_site_admin })
    .eq('id', userId);

  if (updateError) {
    console.error('Toggle admin error:', updateError);
    return { error: 'Failed to update admin status' };
  }

  return { success: true };
}

export async function adminDeleteUser(userId: string) {
  const { error, user } = await requireSiteAdmin();
  if (error) return { error };

  if (userId === user!.id) return { error: 'Cannot delete your own account' };

  const serviceClient = createServiceRoleClient();
  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error('Delete user error:', deleteError);
    return { error: 'Failed to delete user' };
  }

  return { success: true };
}

export async function adminDeleteGroup(groupId: string) {
  const { error } = await requireSiteAdmin();
  if (error) return { error };

  const serviceClient = createServiceRoleClient();
  const { error: deleteError } = await serviceClient
    .from('groups')
    .delete()
    .eq('id', groupId);

  if (deleteError) {
    console.error('Delete group error:', deleteError);
    return { error: 'Failed to delete group' };
  }

  return { success: true };
}

export async function adminDeleteInvitation(invitationId: string) {
  const { error } = await requireSiteAdmin();
  if (error) return { error };

  const serviceClient = createServiceRoleClient();
  const { error: deleteError } = await serviceClient
    .from('invitations')
    .delete()
    .eq('id', invitationId);

  if (deleteError) {
    console.error('Delete invitation error:', deleteError);
    return { error: 'Failed to delete invitation' };
  }

  return { success: true };
}
