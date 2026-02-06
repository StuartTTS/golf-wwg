'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
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
    <div className="w-full max-w-md space-y-8">
      {/* Heading */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-dark-900">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-dark-700">
          Enter your email and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      {/* Success state */}
      {submitted ? (
        <div className="space-y-6">
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-golf-600">
              If an account exists with that email, you will receive a password
              reset link shortly. Please check your inbox.
            </p>
          </div>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-golf-600 hover:text-golf-700"
            >
              Back to sign in
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
                htmlFor="email"
                className="block text-sm font-medium text-dark-800"
              >
                Email address
              </label>
              <div className="mt-1">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  disabled={isPending}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Sending link...' : 'Send reset link'}
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
