'use client';

// Reusable buy-in + payout editor shown for every game format when adding a
// game. Captures a per-player buy-in, how many places pay out, and the split
// (percent of pot, or flat dollar amounts). The pot = buyIn × players.

import { validatePayout, type PayoutConfig } from '@golf/core';
import { Input } from '@/components/ui/input';

// Standard payout curves by number of paid places (percent of pot).
const PERCENT_PRESETS: Record<number, number[]> = {
  1: [100],
  2: [70, 30],
  3: [50, 30, 20],
  4: [40, 30, 20, 10],
  5: [35, 25, 20, 12, 8],
};

export function defaultPayout(): PayoutConfig {
  return { buyIn: 5, places: 1, splitMode: 'percent', split: [100] };
}

function defaultSplit(places: number, mode: PayoutConfig['splitMode']): number[] {
  if (mode === 'percent') {
    if (PERCENT_PRESETS[places]) return [...PERCENT_PRESETS[places]];
    const even = Math.floor(100 / places);
    const arr = Array(places).fill(even);
    arr[0] += 100 - even * places; // remainder on 1st
    return arr;
  }
  return Array(places).fill(0);
}

export function PayoutFields({
  value,
  onChange,
  playerCount,
}: {
  value: PayoutConfig;
  onChange: (next: PayoutConfig) => void;
  playerCount: number;
}) {
  const pot = (value.buyIn || 0) * playerCount;
  const maxPlaces = Math.max(1, Math.min(playerCount || 1, 10));
  const error = validatePayout(value, playerCount);

  const setPlaces = (places: number) => {
    onChange({ ...value, places, split: defaultSplit(places, value.splitMode) });
  };
  const setMode = (splitMode: PayoutConfig['splitMode']) => {
    onChange({ ...value, splitMode, split: defaultSplit(value.places, splitMode) });
  };
  const setSplitAt = (i: number, n: number) => {
    const split = [...value.split];
    split[i] = Number.isNaN(n) ? 0 : n;
    onChange({ ...value, split });
  };

  return (
    <div className="space-y-3 rounded-lg border border-surface-600 bg-surface-800/50 p-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-surface-100 mb-1">
            Buy-in per player ($)
          </label>
          <Input
            type="number"
            min="0"
            step="1"
            value={String(value.buyIn)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ ...value, buyIn: parseFloat(e.target.value) || 0 })
            }
            placeholder="0"
          />
        </div>
        <div className="pb-2 text-right">
          <p className="text-[11px] uppercase tracking-wide text-surface-400">Pot</p>
          <p className="text-lg font-bold text-golf-500 tabular-nums">${pot}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-100 mb-1">
          Places paid
        </label>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: maxPlaces }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPlaces(n)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                value.places === n
                  ? 'bg-golf-600 text-white'
                  : 'bg-surface-700 text-surface-200 hover:bg-surface-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-surface-100">Split</label>
          <div className="inline-flex rounded-lg bg-surface-700 p-0.5 text-xs">
            {(['percent', 'amount'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                  value.splitMode === m
                    ? 'bg-golf-600 text-white font-medium'
                    : 'text-surface-300 hover:text-surface-100'
                }`}
              >
                {m === 'percent' ? '%' : '$'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {value.split.map((s, i) => {
            const dollars =
              value.splitMode === 'percent'
                ? Math.round(((pot * s) / 100) * 100) / 100
                : s;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 text-xs text-surface-300 shrink-0">
                  {ordinal(i + 1)}
                </span>
                <Input
                  type="number"
                  min="0"
                  step={value.splitMode === 'percent' ? '1' : '1'}
                  value={String(s)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSplitAt(i, parseFloat(e.target.value))
                  }
                />
                <span className="w-16 text-right text-xs text-surface-400 tabular-nums shrink-0">
                  {value.splitMode === 'percent' ? `$${dollars}` : `${pctOfPot(s, pot)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]} place`;
}

function pctOfPot(amount: number, pot: number): number {
  if (!pot) return 0;
  return Math.round((amount / pot) * 100);
}
