'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { startModes } from '@/lib/nav-modes';

interface StartSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mobile "Start" bottom sheet: the collapsed form of the desktop Start parent.
 * Lists the modes with always-visible descriptions (the primary way people
 * learn what each mode is). Unbuilt modes render disabled with a "Soon" badge.
 */
export function StartSheet({ isOpen, onClose }: StartSheetProps) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="absolute bottom-0 left-0 right-0 bg-surface-800 rounded-t-2xl p-6"
        style={{ animation: 'slideUp 200ms ease-out' }}
      >
        <div className="w-12 h-1 rounded-full bg-surface-500 mx-auto mb-5" />
        <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3 px-1">
          Start a…
        </p>

        <div className="space-y-2">
          {startModes.map((m) => {
            const Icon = m.icon;
            const inner = (
              <>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-700 text-golf-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-surface-50">{m.label}</span>
                    {!m.available && (
                      <span className="text-[10px] uppercase tracking-wide text-surface-400 bg-surface-700 rounded px-1.5 py-0.5">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-surface-300 truncate">{m.description}</p>
                </div>
              </>
            );

            return m.available ? (
              <Link
                key={m.key}
                href={m.href}
                onClick={onClose}
                className="flex items-center gap-3 p-2 rounded-xl border border-surface-600 hover:border-golf-500 hover:bg-golf-900/20 transition-colors"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={m.key}
                className="flex items-center gap-3 p-2 rounded-xl border border-surface-700 opacity-60 cursor-default select-none"
              >
                {inner}
              </div>
            );
          })}
        </div>

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
