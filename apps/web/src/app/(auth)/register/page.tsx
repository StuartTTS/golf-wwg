'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { register } from '@/lib/actions/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await register(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push('/home');
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Heading */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-dark-900">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-dark-600">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-golf-600 hover:text-golf-700"
          >
            Sign in
          </Link>
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md bg-red-900/30 border border-red-800/50 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium text-dark-800"
          >
            Display name
          </label>
          <div className="mt-1">
            <Input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              required
              placeholder="Tiger Woods"
              disabled={isPending}
            />
          </div>
        </div>

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

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-dark-800"
          >
            Password
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

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </div>
  );
}
