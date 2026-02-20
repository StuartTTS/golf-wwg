'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@golf/core';

async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

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

  const ip = await getClientIp();
  const { allowed } = await checkRateLimit({
    key: `login:${ip}`,
    maxAttempts: 5,
    windowSeconds: 900, // 15 minutes
  });
  if (!allowed) {
    return { error: 'Too many login attempts. Please try again in 15 minutes.' };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: 'Invalid email or password' };
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

  const ip = await getClientIp();
  const { allowed } = await checkRateLimit({
    key: `register:${ip}`,
    maxAttempts: 3,
    windowSeconds: 3600, // 1 hour
  });
  if (!allowed) {
    return { error: 'Too many registration attempts. Please try again later.' };
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
    return { error: 'Unable to create account. Please try again.' };
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

  const ip = await getClientIp();
  const { allowed: ipAllowed } = await checkRateLimit({
    key: `forgot-password:${ip}`,
    maxAttempts: 5,
    windowSeconds: 3600,
  });
  if (!ipAllowed) {
    return { success: true }; // Don't reveal rate limiting on forgot-password
  }
  const { allowed: emailAllowed } = await checkRateLimit({
    key: `forgot-password:${parsed.data.email}`,
    maxAttempts: 3,
    windowSeconds: 3600,
  });
  if (!emailAllowed) {
    return { success: true }; // Don't reveal rate limiting
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    },
  );

  if (error) {
    console.error('Password reset error:', error.message);
  }

  // Always return success to prevent email enumeration
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
    return { error: 'Unable to reset password. Please try again.' };
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

  const ip = await getClientIp();
  const { allowed } = await checkRateLimit({
    key: `invite:${ip}`,
    maxAttempts: 10,
    windowSeconds: 3600,
  });
  if (!allowed) {
    return { error: 'Too many attempts. Please try again later.' };
  }

  const supabase = await createServerSupabaseClient();

  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return { error: 'You must be logged in to accept an invite' };
  }

  const userId = sessionData.session.user.id;

  // Mark the invite as accepted (only if not expired)
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'accepted' })
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());

  if (error) {
    return { error: 'Invalid or expired invitation' };
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

  const ip = await getClientIp();
  const { allowed } = await checkRateLimit({
    key: `invite:${ip}`,
    maxAttempts: 10,
    windowSeconds: 3600,
  });
  if (!allowed) {
    return { error: 'Too many attempts. Please try again later.' };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('invitations')
    .update({ status: 'declined' })
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());

  if (error) {
    return { error: 'Invalid or expired invitation' };
  }

  return { success: true };
}
