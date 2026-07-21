'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  MapPin,
  Trophy,
  ClipboardList,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MoreDrawer } from './more-drawer';
import { StartSheet } from './start-sheet';
import { featureFlags } from '@/lib/feature-flags';
import { joinGame } from '@/lib/nav-modes';

interface NavTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const legacyTabs: NavTab[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/courses', label: 'Courses', icon: MapPin },
  { href: '/rounds', label: 'Rounds', icon: Trophy },
];

function TabLink({ tab, active }: { tab: NavTab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
        active ? 'text-gold-500 border-t-2 border-gold-500' : 'text-surface-400'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium mt-1">{tab.label}</span>
    </Link>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const v2 = featureFlags.navV2;
  const JoinIcon = joinGame.icon;

  return (
    <>
      <nav className="flex h-16 items-stretch border-t border-surface-700 bg-surface-900/90 backdrop-blur-md pb-safe">
        {v2 ? (
          <>
            <TabLink
              tab={{ href: '/home', label: 'Home', icon: Home }}
              active={pathname.startsWith('/home')}
            />
            <TabLink
              tab={{ href: '/rounds', label: 'Rounds', icon: ClipboardList }}
              active={pathname.startsWith('/rounds')}
            />

            {/* Center: Start (opens the mode chooser) */}
            <button
              type="button"
              onClick={() => setStartOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 text-surface-300"
              aria-label="Start a round"
            >
              <span className="flex h-11 w-11 -mt-4 items-center justify-center rounded-full bg-golf-600 text-white shadow-lg ring-4 ring-surface-900">
                <Plus className="h-6 w-6" />
              </span>
              <span className="text-xs font-medium -mt-1">Start</span>
            </button>

            {/* Join Game (coming soon) */}
            <button
              type="button"
              disabled
              title="Join Game — coming soon"
              className="flex flex-1 flex-col items-center justify-center gap-0.5 text-surface-500 cursor-default"
            >
              <JoinIcon className="h-5 w-5" />
              <span className="mt-1 flex items-center gap-1 text-xs font-medium">
                Join Game
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 text-surface-400 transition-colors"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-xs font-medium mt-1">More</span>
            </button>
          </>
        ) : (
          <>
            {legacyTabs.map((tab) => (
              <TabLink key={tab.href} tab={tab} active={pathname.startsWith(tab.href)} />
            ))}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 text-surface-400 transition-colors"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-xs font-medium mt-1">More</span>
            </button>
          </>
        )}
      </nav>

      {v2 && <StartSheet isOpen={startOpen} onClose={() => setStartOpen(false)} />}
      <MoreDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
