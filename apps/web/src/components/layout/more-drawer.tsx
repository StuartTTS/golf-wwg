'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { User, Settings, Shield, LogOut } from 'lucide-react';
import { logout } from '@/lib/actions/auth';
import { useAuth } from '@/providers/auth-provider';

interface MoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MoreDrawer({ isOpen, onClose }: MoreDrawerProps) {
  const { profile } = useAuth();
  const isSiteAdmin = (profile as any)?.is_site_admin === true;

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-surface-800 rounded-t-2xl p-6 animate-slide-up"
        style={{
          animation: 'slideUp 200ms ease-out',
        }}
      >
        {/* Handle bar */}
        <div className="w-12 h-1 rounded-full bg-surface-500 mx-auto mb-6" />

        {/* Menu items */}
        <div className="space-y-1">
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 p-3 rounded-golf text-surface-200 hover:bg-surface-700 transition-colors"
          >
            <User className="h-5 w-5" />
            <span className="text-sm font-medium">Profile</span>
          </Link>

          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-3 p-3 rounded-golf text-surface-200 hover:bg-surface-700 transition-colors"
          >
            <Settings className="h-5 w-5" />
            <span className="text-sm font-medium">Settings</span>
          </Link>

          {isSiteAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center gap-3 p-3 rounded-golf text-surface-200 hover:bg-surface-700 transition-colors"
            >
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">Site Admin</span>
            </Link>
          )}

          <form action={async () => { await logout(); }}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 p-3 rounded-golf text-red-400 hover:bg-surface-700 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </form>
        </div>

        {/* Safe area spacing at bottom */}
        <div className="pb-safe" />
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
