'use client';

import {
  forwardRef,
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

// ── Simple <Select> (native HTML) ──────────────────────────────────────
interface SimpleSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SimpleSelect = forwardRef<HTMLSelectElement, SimpleSelectProps>(
  ({ className = '', label, error, id, options, placeholder, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-dark-800">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={`block w-full rounded-md border border-dark-300 bg-dark-200 px-3 py-2 text-sm text-dark-900 focus:border-golf-500 focus:outline-none focus:ring-1 focus:ring-golf-500 disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
          } ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);

SimpleSelect.displayName = 'SimpleSelect';

// ── Compound Select (SelectTrigger / SelectValue / SelectContent / SelectItem) ─
interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextType | null>(null);

function useSelectContext() {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('Select compound components must be used within <Select>');
  return ctx;
}

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export function Select({ value: controlledValue, defaultValue = '', onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  const value = controlledValue ?? internalValue;
  const handleChange = (newValue: string) => {
    if (controlledValue === undefined) setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className = '', children }: { className?: string; children: ReactNode }) {
  const { open, setOpen } = useSelectContext();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={`flex w-full items-center justify-between rounded-md border border-dark-300 bg-dark-200 px-3 py-2 text-sm text-dark-900 focus:border-golf-500 focus:outline-none focus:ring-1 focus:ring-golf-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
      <svg className="ml-2 h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = useSelectContext();
  return <span className={value ? '' : 'text-dark-500'}>{value || placeholder || ''}</span>;
}

export function SelectContent({ children }: { children: ReactNode }) {
  const { open, setOpen } = useSelectContext();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-dark-300 bg-dark-100 py-1 shadow-lg"
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  const { value: selectedValue, onValueChange, setOpen } = useSelectContext();
  const isSelected = selectedValue === value;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className={`cursor-pointer px-3 py-2 text-sm hover:bg-dark-300 ${
        isSelected ? 'bg-dark-300 font-medium text-golf-600' : 'text-dark-800'
      }`}
    >
      {children}
    </div>
  );
}
