'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, MapPin, Trophy, MoreHorizontal } from 'lucide-react';
import { MoreDrawer } from './more-drawer';
import type { LucideIcon } from 'lucide-react';

interface NavTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const tabs: NavTab[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/courses', label: 'Courses', icon: MapPin },
  { href: '/rounds', label: 'Rounds', icon: Trophy },
];

export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <nav className="flex h-16 items-stretch border-t border-surface-700 bg-surface-900/90 backdrop-blur-md pb-safe">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? 'text-gold-500 border-t-2 border-gold-500'
                  : 'text-surface-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium mt-1">{tab.label}</span>
            </Link>
          );
        })}

        {/* More tab */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-surface-400 transition-colors"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-xs font-medium mt-1">More</span>
        </button>
      </nav>

      <MoreDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
