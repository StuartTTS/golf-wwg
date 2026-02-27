import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-surface-200">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`block w-full rounded-golf border border-surface-500 bg-surface-800 px-3 py-2 text-base text-surface-100 placeholder:text-surface-400 focus:border-golf-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
