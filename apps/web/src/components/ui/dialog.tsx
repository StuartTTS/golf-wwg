'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, onClose, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (!open || !contentRef.current) return;

    const content = contentRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusableElements = content.querySelectorAll<HTMLElement>(focusableSelector);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus the first focusable element
    firstFocusable?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        className="relative mx-4 w-full max-w-lg rounded-golf-lg bg-surface-800 shadow-elevated animate-in zoom-in-95 fade-in duration-150"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-golf-sm p-1.5 text-surface-400 transition-colors hover:bg-surface-700 hover:text-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/30"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`px-6 pt-6 pb-2 ${className}`}>{children}</div>;
}

export function DialogTitle({ className = '', children }: { className?: string; children: ReactNode }) {
  return <h2 className={`text-lg font-semibold text-surface-100 ${className}`}>{children}</h2>;
}

export function DialogBody({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

export function DialogFooter({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`flex items-center justify-end gap-3 px-6 pb-6 ${className}`}>{children}</div>;
}
