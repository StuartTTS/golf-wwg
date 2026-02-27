'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { register } from '@/lib/actions/auth';

function RegisterForm() {
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
      const result = await register(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      // Full page navigation — the redirect target (e.g. /invite/{token}) is a
      // server component that calls redirect() itself, which doesn't resolve
      // cleanly inside a client-side router.push() transition.
      const rawRedirect = searchParams.get('redirect') || '/home';
      const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/home';
      window.location.href = redirectTo;
    });
  }

  const redirectParam = searchParams.get('redirect');
  const emailParam = searchParams.get('email');
  const loginHref = (() => {
    const params = new URLSearchParams();
    if (redirectParam) params.set('redirect', redirectParam);
    if (emailParam) params.set('email', emailParam);
    const qs = params.toString();
    return qs ? `/login?${qs}` : '/login';
  })();

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-surface-50">
          Join the Club
        </h1>
        <p className="mt-2 text-sm text-surface-400">
          Create your account
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
            htmlFor="displayName"
            className="block text-sm font-medium text-surface-300"
          >
            Display name
          </label>
          <div className="mt-1.5">
            <Input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              required
              placeholder="Tiger Woods"
              disabled={isPending}
              className="border-surface-600 bg-surface-700/50 text-surface-100 placeholder:text-surface-400 focus:border-golf-500 focus:ring-2 focus:ring-gold-500/30"
            />
          </div>
        </div>

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
              readOnly={!!inviteEmail}
              disabled={isPending}
              className={`border-surface-600 bg-surface-700/50 text-surface-100 placeholder:text-surface-400 focus:border-golf-500 focus:ring-2 focus:ring-gold-500/30${inviteEmail ? ' opacity-75' : ''}`}
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

        <Button
          type="submit"
          className="w-full bg-golf-600 hover:bg-golf-500 text-white font-semibold h-12 rounded-golf-lg"
          disabled={isPending}
        >
          {isPending ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      {/* Login CTA */}
      <p className="text-center text-sm text-surface-400">
        Already have an account?{' '}
        <Link
          href={loginHref}
          className="font-medium text-golf-400 hover:text-golf-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
