'use client';

import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui';

export function Header() {
  const { user, profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      {/* Mobile logo */}
      <div className="flex items-center lg:hidden">
        <Link href="/home" className="flex items-center space-x-2">
          <span className="text-2xl">&#9971;</span>
          <span className="text-lg font-bold text-slate-900">GolfApp</span>
        </Link>
      </div>

      {/* Spacer for desktop (sidebar has logo) */}
      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm text-slate-600">
              {profile?.display_name || user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
