'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { inviteMemberSchema } from '@golf/core';
import { randomBytes } from 'crypto';
import { sendEmail, escapeHtml } from '@/lib/email';

export async function createGroup(data: { name: string; description?: string; defaultCourseId?: string }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!data.name || !data.name.trim()) {
    return { error: 'Group name is required' };
  }

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      name: data.name,
      description: data.description ?? null,
      default_course_id: data.defaultCourseId ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }

  // Add creator as admin
  await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: user.id,
    role: 'admin',
  });

  return { success: true, groupId: group.id };
}

export async function updateGroup(data: { groupId: string; name: string; description?: string; defaultCourseId?: string; homeClubId?: string }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', data.groupId)
    .eq('user_id', user.id)
    .single();
  if (!membership || membership.role !== 'admin') {
    return { error: 'Not authorized' };
  }

  const { error } = await supabase
    .from('groups')
    .update({
      name: data.name,
      description: data.description ?? null,
      default_course_id: data.defaultCourseId ?? null,
      home_club_id: data.homeClubId ?? null,
    })
    .eq('id', data.groupId);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}

export async function deleteGroup(groupId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();
  if (!membership || membership.role !== 'admin') {
    return { error: 'Not authorized' };
  }

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}

export async function inviteMember(groupId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();
  if (!membership || membership.role !== 'admin') {
    return { error: 'Not authorized' };
  }

  const parsed = inviteMemberSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role') || 'member',
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { allowed } = await checkRateLimit({
    key: `invite-member:${user.id}`,
    maxAttempts: 10,
    windowSeconds: 3600,
  });
  if (!allowed) {
    return { error: 'Too many invitations sent. Please try again later.' };
  }

  // Check if user already a member
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', parsed.data.email)
    .single();

  if (existingProfile) {
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', existingProfile.id)
      .single();

    if (existingMember) {
      return { error: 'User is already a member of this group' };
    }
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Fetch group name and inviter display name for the email
  const { data: group } = await supabase
    .from('groups')
    .select('name')
    .eq('id', groupId)
    .single();

  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const { data: invitation, error } = await supabase.from('invitations').insert({
    type: 'group',
    group_id: groupId,
    email: parsed.data.email,
    token,
    invited_by: user.id,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
  }).select('id').single();

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }

  // Send the invitation email directly via Microsoft Graph API
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const inviteUrl = `${siteUrl}/invite/${token}?email=${encodeURIComponent(parsed.data.email)}`;
  const groupName = group?.name ?? 'a golf group';
  const inviterName = inviterProfile?.display_name ?? 'Someone';

  try {
    const safeGroupName = escapeHtml(groupName);
    const safeInviterName = escapeHtml(inviterName);
    await sendEmail(
      parsed.data.email,
      `${inviterName} invited you to join ${groupName} on Golf WWG`,
      `
        <h2>You've been invited to join ${safeGroupName}!</h2>
        <p>${safeInviterName} has invited you to join their golf group.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:white;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
        <p>Or copy this link: ${inviteUrl}</p>
        <p>This invitation expires in 7 days.</p>
      `
    );
  } catch (err) {
    console.error('Failed to send invitation email:', err);
    await supabase.from('invitations').delete().eq('id', invitation.id);
    return { error: 'Failed to send invitation email. Please try again.' };
  }

  return { success: true, token };
}

export async function removeMember(groupId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();
  if (!membership || membership.role !== 'admin') {
    return { error: 'Not authorized' };
  }

  if (userId === user.id) {
    // Prevent removing yourself if you're the only admin
    const { data: adminMembers } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('role', 'admin');
    if (!adminMembers || adminMembers.length <= 1) {
      return { error: 'Cannot remove yourself as the only admin' };
    }
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}

export async function updateMemberRole(groupId: string, userId: string, role: 'admin' | 'member') {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();
  if (!membership || membership.role !== 'admin') {
    return { error: 'Not authorized' };
  }

  // Prevent demoting yourself
  if (userId === user.id && role !== 'admin') {
    return { error: 'Cannot demote yourself' };
  }

  const { error } = await supabase
    .from('group_members')
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}
