'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface FABProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label?: string;
}

export function FAB({ icon, label, className = '', ...props }: FABProps) {
  return (
    <button
      type="button"
      className={`fixed bottom-20 right-4 z-40 md:hidden inline-flex items-center justify-center rounded-full bg-golf-500 text-white shadow-elevated transition-all duration-150 ease-out hover:bg-golf-600 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 ${
        label ? 'h-14 gap-2 px-5' : 'h-14 w-14'
      } ${className}`}
      {...props}
    >
      {icon}
      {label && <span className="text-sm font-semibold">{label}</span>}
    </button>
  );
}
