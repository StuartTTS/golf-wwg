'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { forgotPassword } from '@/lib/actions/auth';

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await forgotPassword(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSubmitted(true);
    });
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-surface-50">
          Reset Password
        </h1>
        <p className="mt-2 text-sm text-surface-300">
          Enter your email and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      {/* Success state */}
      {submitted ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 rounded-golf border border-golf-500/20 bg-golf-500/10 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-golf-500/20">
              <Check className="h-5 w-5 text-golf-500" />
            </div>
            <p className="text-center text-sm text-golf-400">
              If an account exists with that email, you will receive a password
              reset link shortly. Please check your inbox.
            </p>
          </div>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-golf-400 hover:text-golf-300"
            >
              Back to sign in
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
                htmlFor="email"
                className="block text-sm font-medium text-surface-300"
              >
                Email address
              </label>
              <div className="mt-1.5">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
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
              {isPending ? 'Sending link...' : 'Send reset link'}
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
