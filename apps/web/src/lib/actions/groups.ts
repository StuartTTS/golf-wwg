'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createGroupSchema, inviteMemberSchema } from '@golf/core';
import { randomBytes } from 'crypto';

export async function createGroup(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createGroupSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    defaultCourseId: formData.get('defaultCourseId') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      default_course_id: parsed.data.defaultCourseId ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Add creator as admin
  await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: user.id,
    role: 'admin',
  });

  return { success: true, groupId: group.id };
}

export async function updateGroup(groupId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('groups')
    .update({
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      default_course_id: (formData.get('defaultCourseId') as string) || null,
    })
    .eq('id', groupId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteGroup(groupId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function inviteMember(groupId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = inviteMemberSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role') || 'member',
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
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

  const { error } = await supabase.from('invitations').insert({
    type: 'group',
    group_id: groupId,
    email: parsed.data.email,
    token,
    invited_by: user.id,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
  });

  if (error) return { error: error.message };
  return { success: true, token };
}

export async function removeMember(groupId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (userId === user.id) {
    return { error: 'Cannot remove yourself' };
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMemberRole(groupId: string, userId: string, role: 'admin' | 'member') {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('group_members')
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) return { error: error.message };
  return { success: true };
}
