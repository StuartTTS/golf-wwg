'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { login } from '@/lib/actions/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const inviteEmail = searchParams.get('email') || '';

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

      // Full page navigation — the redirect target may be a server component
      // that calls redirect(), which doesn't resolve inside router.push().
      const rawRedirect = searchParams.get('redirect') || '/home';
      const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/home';
      window.location.href = redirectTo;
    });
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-surface-50">
          Welcome Back
        </h1>
        <p className="mt-2 text-sm text-surface-400">
          Sign in to your account
        </p>
      </div>

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
              defaultValue={inviteEmail}
              disabled={isPending}
              className="border-surface-600 bg-surface-700/50 text-surface-100 placeholder:text-surface-400 focus:border-golf-500 focus:ring-2 focus:ring-gold-500/30"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-surface-300"
          >
            Password
          </label>
          <div className="mt-1.5">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              disabled={isPending}
              className="border-surface-600 bg-surface-700/50 text-surface-100 placeholder:text-surface-400 focus:border-golf-500 focus:ring-2 focus:ring-gold-500/30"
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-gold-500 hover:text-gold-400"
          >
            Forgot your password?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full bg-golf-600 hover:bg-golf-500 text-white font-semibold h-12 rounded-golf-lg"
          disabled={isPending}
        >
          {isPending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      {/* Register CTA */}
      <p className="text-center text-sm text-surface-400">
        Don&apos;t have an account?{' '}
        <Link
          href={(() => {
            const params = new URLSearchParams();
            const rd = searchParams.get('redirect');
            const em = searchParams.get('email');
            if (rd) params.set('redirect', rd);
            if (em) params.set('email', em);
            const qs = params.toString();
            return qs ? `/register?${qs}` : '/register';
          })()}
          className="font-medium text-golf-400 hover:text-golf-300"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
