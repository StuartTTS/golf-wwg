'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { resetPassword } from '@/lib/actions/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Client-side confirmation check
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    startTransition(async () => {
      const result = await resetPassword(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);

      // Redirect to login after a short delay so the user sees the success
      // message.
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-surface-50">
          Set New Password
        </h1>
        <p className="mt-2 text-sm text-surface-300">
          Enter your new password below.
        </p>
      </div>

      {/* Success state */}
      {success ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 rounded-golf border border-golf-500/20 bg-golf-500/10 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-golf-500/20">
              <Check className="h-5 w-5 text-golf-500" />
            </div>
            <p className="text-center text-sm text-golf-400">
              Your password has been updated successfully. Redirecting you to
              sign in...
            </p>
          </div>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-golf-400 hover:text-golf-300"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Error banner */}
          {error && (
            <div className="rounded-golf border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-surface-300"
              >
                New password
              </label>
              <div className="mt-1.5">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  disabled={isPending}
                  className="border-surface-600 bg-surface-700/50 text-surface-100 placeholder:text-surface-400 focus:border-golf-500 focus:ring-2 focus:ring-gold-500/30"
                />
              </div>
              <p className="mt-1.5 text-xs text-surface-400">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-surface-300"
              >
                Confirm new password
              </label>
              <div className="mt-1.5">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  disabled={isPending}
                  className="border-surface-600 bg-surface-700/50 text-surface-100 placeholder:text-surface-400 focus:border-golf-500 focus:ring-2 focus:ring-gold-500/30"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-golf-600 hover:bg-golf-500 text-white font-semibold h-12 rounded-golf-lg"
              disabled={isPending}
            >
              {isPending ? 'Updating password...' : 'Update password'}
            </Button>
          </form>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-golf-400 hover:text-golf-300"
            >
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
