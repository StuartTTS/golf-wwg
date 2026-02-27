'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import {
  Home,
  Users,
  MapPin,
  User,
  Settings,
  Trophy,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const playItems: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/rounds', label: 'Rounds', icon: Trophy },
];

const manageItems: NavItem[] = [
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/courses', label: 'Courses', icon: MapPin },
];

const accountItems: NavItem[] = [
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-2 mx-auto h-px w-6 bg-surface-600" />;
  return (
    <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
      {label}
    </h3>
  );
}

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 py-2.5 text-sm font-medium rounded-golf transition-colors duration-golf ease-golf ${
        collapsed ? 'justify-center px-0' : 'px-3'
      } ${
        isActive
          ? 'border-l-2 border-golf-500 bg-surface-700/50 text-gold-500'
          : 'text-surface-300 hover:bg-surface-600/50 hover:text-surface-100'
      }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { profile, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const displayName = profile?.display_name || user?.email || 'Golfer';
  const isSiteAdmin = (profile as any)?.is_site_admin === true;

  return (
    <div
      className={`flex h-full flex-col bg-surface-900 border-r border-surface-700 transition-all duration-200 ease-golf ${
        collapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Brand + Collapse toggle */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-surface-700">
        {!collapsed && (
          <Link href="/home" className="flex items-center gap-2">
            <span className="text-golf-500 font-display text-xl font-extrabold">WWG</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center justify-center h-8 w-8 rounded-golf text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors ${
            collapsed ? 'mx-auto' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto py-6 space-y-6 ${collapsed ? 'px-2' : 'px-4'}`}>
        <div>
          <SectionHeader label="Play" collapsed={collapsed} />
          <div className="space-y-1">
            {playItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname.startsWith(item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionHeader label="Manage" collapsed={collapsed} />
          <div className="space-y-1">
            {manageItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname.startsWith(item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionHeader label="Account" collapsed={collapsed} />
          <div className="space-y-1">
            {accountItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname.startsWith(item.href)}
                collapsed={collapsed}
              />
            ))}
            {isSiteAdmin && (
              <NavLink
                item={{ href: '/admin', label: 'Site Admin', icon: Shield }}
                isActive={pathname.startsWith('/admin')}
                collapsed={collapsed}
              />
            )}
          </div>
        </div>
      </nav>

      {/* User info at bottom */}
      <div className="border-t border-surface-700 p-4">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-golf-700 text-sm font-semibold text-golf-100 flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-surface-100">
                {displayName}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
