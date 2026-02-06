'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { login } from '@/lib/actions/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await login(formData);

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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Sign in to your account
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Or{' '}
          <Link
            href="/register"
            className="font-medium text-green-600 hover:text-green-500"
          >
            create a new account
          </Link>
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
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
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <div className="mt-1">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-green-600 hover:text-green-500"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
