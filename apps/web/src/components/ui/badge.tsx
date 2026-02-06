import type { HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-dark-300 text-dark-800',
  secondary: 'bg-golf-50 text-golf-600',
  outline: 'border border-dark-400 text-dark-700',
  success: 'bg-emerald-900/40 text-emerald-400',
  warning: 'bg-yellow-900/40 text-yellow-400',
  error: 'bg-red-900/40 text-red-400',
  info: 'bg-blue-900/40 text-blue-400',
};

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
