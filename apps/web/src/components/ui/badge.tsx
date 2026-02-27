import type { HTMLAttributes } from 'react';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'leader'
  | 'under-par'
  | 'over-par';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-600 text-surface-100',
  secondary: 'bg-golf-900/60 text-golf-400',
  outline: 'border border-surface-500 text-surface-200',
  success: 'bg-emerald-900/40 text-emerald-400',
  warning: 'bg-yellow-900/40 text-yellow-400',
  error: 'bg-red-900/40 text-red-400',
  info: 'bg-blue-900/40 text-blue-400',
  leader: 'bg-gold-500 text-surface-900',
  'under-par': 'bg-red-900/40 text-red-400',
  'over-par': 'bg-blue-900/40 text-blue-400',
};

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
