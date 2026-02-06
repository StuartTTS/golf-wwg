'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@golf/core';

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

export type AuthActionResult = {
  error?: string;
  success?: boolean;
};

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(formData: FormData): Promise<AuthActionResult> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function register(formData: FormData): Promise<AuthActionResult> {
  const raw = {
    displayName: formData.get('displayName'),
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = registerSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createServerSupabaseClient();

  // 1. Create the auth user
  const { data, error: signUpError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
      },
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  // Profile row is created automatically by the on_auth_user_created trigger.
  return { success: true };
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(): Promise<AuthActionResult> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  redirect('/login');
}

// ---------------------------------------------------------------------------
// Forgot password -- sends a password-reset email
// ---------------------------------------------------------------------------

export async function forgotPassword(
  formData: FormData,
): Promise<AuthActionResult> {
  const raw = {
    email: formData.get('email'),
  };

  const parsed = forgotPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    },
  );

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Reset password -- sets a new password (user must already have a valid
// session from the magic-link / OTP that Supabase emails).
// ---------------------------------------------------------------------------

export async function resetPassword(
  formData: FormData,
): Promise<AuthActionResult> {
  const raw = {
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const parsed = resetPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Accept invite
// ---------------------------------------------------------------------------

export async function acceptInvite(token: string): Promise<AuthActionResult> {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid invite token' };
  }

  const supabase = await createServerSupabaseClient();

  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return { error: 'You must be logged in to accept an invite' };
  }

  const userId = sessionData.session.user.id;

  // Mark the invite as accepted
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'accepted' })
    .eq('token', token)
    .eq('status', 'pending');

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Decline invite
// ---------------------------------------------------------------------------

export async function declineInvite(token: string): Promise<AuthActionResult> {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid invite token' };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('invitations')
    .update({ status: 'declined' })
    .eq('token', token)
    .eq('status', 'pending');

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
