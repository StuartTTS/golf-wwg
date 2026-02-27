import type { HTMLAttributes } from 'react';

type CardVariant = 'default' | 'glass' | 'highlighted';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: CardVariant;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-surface-800 border-surface-500 shadow-card',
  glass: 'bg-surface-800/80 backdrop-blur-sm border-surface-500 shadow-card',
  highlighted: 'bg-surface-800 border-gold-500 shadow-glow',
};

export function Card({ className = '', padding = 'md', variant = 'default', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-golf border transition-all duration-150 ease-out hover:shadow-elevated hover:-translate-y-px ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-lg font-semibold text-surface-100 ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-sm text-surface-300 ${className}`} {...props}>
      {children}
    </p>
  );
}
