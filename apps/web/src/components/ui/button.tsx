import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-golf-600 text-white hover:bg-golf-700 focus-visible:ring-gold-500/30',
  secondary:
    'bg-surface-700 text-surface-100 hover:bg-surface-600 focus-visible:ring-gold-500/30',
  outline:
    'border border-surface-500 bg-transparent text-surface-100 hover:bg-surface-700 focus-visible:ring-gold-500/30',
  ghost:
    'text-surface-100 hover:bg-surface-700 focus-visible:ring-gold-500/30',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/30',
  accent:
    'bg-gold-500 text-surface-900 hover:bg-gold-600 focus-visible:ring-gold-500/30',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-golf font-semibold transition-all duration-golf ease-golf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
