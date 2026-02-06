'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    <div className="w-full max-w-md space-y-8">
      {/* Heading */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-dark-900">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-dark-700">
          Enter your new password below.
        </p>
      </div>

      {/* Success state */}
      {success ? (
        <div className="space-y-6">
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-golf-600">
              Your password has been updated successfully. Redirecting you to
              sign in...
            </p>
          </div>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-golf-600 hover:text-golf-700"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Error banner */}
          {error && (
            <div className="rounded-md bg-red-900/30 p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-dark-800"
              >
                New password
              </label>
              <div className="mt-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  disabled={isPending}
                />
              </div>
              <p className="mt-1 text-xs text-dark-600">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-dark-800"
              >
                Confirm new password
              </label>
              <div className="mt-1">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  disabled={isPending}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Updating password...' : 'Update password'}
            </Button>
          </form>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-golf-600 hover:text-golf-700"
            >
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
