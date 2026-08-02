'use client';

// The single source of truth for the roster add/edit form fields. Both the "Add
// a player" card and the inline edit row render this, so restyling or reordering
// the form — or changing which contact fields drive matching — happens in ONE
// place. Controlled via a plain value/onChange object.

import { Input } from '@/components/ui';

export interface RosterFormValue {
  name: string;
  hcp: string; // raw text; parse on save
  email: string;
  phone: string;
}

export const emptyRosterForm = (): RosterFormValue => ({
  name: '',
  hcp: '',
  email: '',
  phone: '',
});

export function rosterFormFrom(entry: {
  displayName: string;
  handicapIndex: number | null;
  email: string | null;
  phone: string | null;
}): RosterFormValue {
  return {
    name: entry.displayName,
    hcp: entry.handicapIndex?.toString() ?? '',
    email: entry.email ?? '',
    phone: entry.phone ?? '',
  };
}

export function RosterPlayerFields({
  value,
  onChange,
  autoFocus,
}: {
  value: RosterFormValue;
  onChange: (patch: Partial<RosterFormValue>) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-surface-200">
            Name <span className="text-red-400">*</span>
          </span>
          <Input
            autoFocus={autoFocus}
            placeholder="Player name"
            value={value.name}
            onChange={(e: any) => onChange({ name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-surface-200">
            Handicap index
          </span>
          <Input
            inputMode="decimal"
            placeholder="e.g. 12.4"
            value={value.hcp}
            onChange={(e: any) => onChange({ hcp: e.target.value })}
          />
        </label>
      </div>

      {/* Contact drives hands-free matching — kept visually distinct so its
          importance is obvious, and self-contained for easy restyling. */}
      <div className="rounded-lg border border-golf-600/30 bg-golf-900/10 p-3 space-y-2.5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-golf-400">
            Contact — links them automatically
          </p>
          <p className="mt-0.5 text-xs text-surface-400">
            Add a phone or email and they&apos;ll auto-link to their own account
            when they join a game — no manual matching needed.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-surface-200">Phone</span>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="(555) 123-4567"
              value={value.phone}
              onChange={(e: any) => onChange({ phone: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-surface-200">Email</span>
            <Input
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={value.email}
              onChange={(e: any) => onChange({ email: e.target.value })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
