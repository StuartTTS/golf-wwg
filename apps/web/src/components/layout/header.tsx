'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { Plus, LogOut, ChevronRight } from 'lucide-react';
import { logout } from '@/lib/actions/auth';

const routeLabels: Record<string, string> = {
  home: 'Home',
  groups: 'Groups',
  courses: 'Courses',
  rounds: 'Rounds',
  profile: 'Profile',
  settings: 'Settings',
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/');
    const label = routeLabels[seg] || decodeURIComponent(seg);
    const isLast = idx === segments.length - 1;

    return (
      <span key={href} className="flex items-center gap-1.5">
        {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-surface-500" />}
        {isLast ? (
          <span className="text-sm font-semibold text-surface-100">{label}</span>
        ) : (
          <Link href={href} className="text-sm text-surface-400 hover:text-surface-200 transition-colors">
            {label}
          </Link>
        )}
      </span>
    );
  });

  return <nav className="flex items-center gap-1.5">{crumbs}</nav>;
}

export function Header() {
  const { user, profile } = useAuth();

  const displayName = profile?.display_name || user?.email;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-surface-700 bg-surface-900/80 backdrop-blur-sm px-4 lg:px-6">
      {/* Mobile: WWG logo */}
      <div className="flex items-center lg:hidden">
        <Link href="/home" className="flex items-center gap-2">
          <span className="text-golf-500 font-display text-xl font-extrabold">WWG</span>
        </Link>
      </div>

      {/* Desktop: breadcrumb */}
      <div className="hidden lg:block">
        <Breadcrumb />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {user && (
          <>
            {/* Start Round button */}
            <Link
              href="/rounds/new"
              className="inline-flex items-center gap-2 rounded-full bg-golf-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-golf ease-golf hover:bg-golf-500"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Start Round</span>
            </Link>

            {/* User display name - desktop only */}
            <span className="hidden lg:inline text-sm text-surface-300">
              {displayName}
            </span>

            {/* Sign out - desktop only */}
            <form className="hidden lg:block" action={async () => { await logout(); }}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-golf px-3 py-1.5 text-sm text-surface-400 transition-colors hover:bg-surface-700 hover:text-surface-200"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
