'use client';

import {
  forwardRef,
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';

// -- Simple <Select> (native HTML) --
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
          <label htmlFor={id} className="block text-sm font-medium text-surface-200">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={`block w-full rounded-golf border border-surface-500 bg-surface-800 px-3 py-2 text-base text-surface-100 focus:border-golf-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''
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

// -- Compound Select (SelectTrigger / SelectValue / SelectContent / SelectItem) --
interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
  itemValues: string[];
  registerItem: (value: string) => void;
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [itemValues, setItemValues] = useState<string[]>([]);

  const value = controlledValue ?? internalValue;
  const handleChange = (newValue: string) => {
    if (controlledValue === undefined) setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  const registerItem = useCallback((val: string) => {
    setItemValues((prev) => (prev.includes(val) ? prev : [...prev, val]));
  }, []);

  return (
    <SelectContext.Provider
      value={{ value, onValueChange: handleChange, open, setOpen, highlightedIndex, setHighlightedIndex, itemValues, registerItem }}
    >
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className = '', children }: { className?: string; children: ReactNode }) {
  const { open, setOpen, highlightedIndex, setHighlightedIndex, itemValues, onValueChange } = useSelectContext();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(Math.min(highlightedIndex + 1, itemValues.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(Math.max(highlightedIndex - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < itemValues.length) {
          onValueChange(itemValues[highlightedIndex]);
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      onKeyDown={handleKeyDown}
      className={`flex w-full items-center justify-between rounded-golf border border-surface-500 bg-surface-800 px-3 py-2 text-base text-surface-100 focus:border-golf-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
      <ChevronDown className={`ml-2 h-4 w-4 text-surface-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = useSelectContext();
  return <span className={value ? 'text-surface-100' : 'text-surface-400'}>{value || placeholder || ''}</span>;
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
      role="listbox"
      className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-golf border border-surface-500 bg-surface-700 py-1 shadow-elevated"
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  const { value: selectedValue, onValueChange, setOpen, highlightedIndex, itemValues, registerItem } = useSelectContext();
  const isSelected = selectedValue === value;
  const index = itemValues.indexOf(value);
  const isHighlighted = highlightedIndex === index;

  useEffect(() => {
    registerItem(value);
  }, [value, registerItem]);

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
        isHighlighted ? 'bg-surface-600 text-surface-100' : ''
      } ${
        isSelected ? 'bg-surface-600 font-medium text-golf-400' : 'text-surface-200'
      } ${
        !isHighlighted && !isSelected ? 'hover:bg-surface-600' : ''
      }`}
    >
      {children}
    </div>
  );
}
