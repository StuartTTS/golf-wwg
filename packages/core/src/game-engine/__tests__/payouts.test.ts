import { describe, it, expect } from 'vitest';
import { computePayouts } from '../payouts';
import type { PayoutConfig } from '../../types/game-payout';

const sum = (arr: { amount: number }[]) =>
  Math.round(arr.reduce((a, r) => a + r.amount, 0) * 100) / 100;

describe('computePayouts', () => {
  it('winner-takes-all pays only 1st, pot = buyIn × players', () => {
    const cfg: PayoutConfig = { buyIn: 20, places: 1, splitMode: 'percent', split: [100] };
    const out = computePayouts(
      [
        { id: 'a', position: 1 },
        { id: 'b', position: 2 },
        { id: 'c', position: 3 },
        { id: 'd', position: 4 },
      ],
      cfg,
      4
    );
    expect(out.find((o) => o.id === 'a')!.amount).toBe(80); // 20 × 4
    expect(out.find((o) => o.id === 'b')!.amount).toBe(0);
    expect(sum(out)).toBe(80);
  });

  it('percent split across 3 places (50/30/20)', () => {
    const cfg: PayoutConfig = { buyIn: 10, places: 3, splitMode: 'percent', split: [50, 30, 20] };
    const out = computePayouts(
      [
        { id: 'a', position: 1 },
        { id: 'b', position: 2 },
        { id: 'c', position: 3 },
        { id: 'd', position: 4 },
        { id: 'e', position: 5 },
      ],
      cfg,
      5
    ); // pot = 50
    expect(out.find((o) => o.id === 'a')!.amount).toBe(25);
    expect(out.find((o) => o.id === 'b')!.amount).toBe(15);
    expect(out.find((o) => o.id === 'c')!.amount).toBe(10);
    expect(out.find((o) => o.id === 'd')!.amount).toBe(0);
    expect(sum(out)).toBe(50);
  });

  it('dollar-amount split', () => {
    const cfg: PayoutConfig = { buyIn: 25, places: 2, splitMode: 'amount', split: [70, 30] };
    const out = computePayouts(
      [
        { id: 'a', position: 1 },
        { id: 'b', position: 2 },
        { id: 'c', position: 3 },
        { id: 'd', position: 4 },
      ],
      cfg,
      4
    ); // pot = 100, split sums to 100
    expect(out.find((o) => o.id === 'a')!.amount).toBe(70);
    expect(out.find((o) => o.id === 'b')!.amount).toBe(30);
    expect(sum(out)).toBe(100);
  });

  it('two tied for 2nd of 3 paid places pool 2nd+3rd and split equally', () => {
    // places 2 & 3 pooled: 30 + 20 = 50 → 25 each
    const cfg: PayoutConfig = { buyIn: 10, places: 3, splitMode: 'percent', split: [50, 30, 20] };
    const out = computePayouts(
      [
        { id: 'a', position: 1 },
        { id: 'b', position: 2 },
        { id: 'c', position: 2 }, // tie for 2nd
        { id: 'd', position: 4 },
      ],
      cfg,
      10
    ); // pot = 100
    expect(out.find((o) => o.id === 'a')!.amount).toBe(50);
    expect(out.find((o) => o.id === 'b')!.amount).toBe(25);
    expect(out.find((o) => o.id === 'c')!.amount).toBe(25);
    expect(out.find((o) => o.id === 'd')!.amount).toBe(0);
    expect(sum(out)).toBe(100);
  });

  it('tie spanning the cut line only pools funded places', () => {
    // 2 places paid; a=1st, b & c tie for 2nd. Pool place 2 (+ unpaid place 3=0) → split 2nd's share.
    const cfg: PayoutConfig = { buyIn: 10, places: 2, splitMode: 'percent', split: [60, 40] };
    const out = computePayouts(
      [
        { id: 'a', position: 1 },
        { id: 'b', position: 2 },
        { id: 'c', position: 2 },
      ],
      cfg,
      10
    ); // pot = 100; 2nd share = 40 → 20 each
    expect(out.find((o) => o.id === 'a')!.amount).toBe(60);
    expect(out.find((o) => o.id === 'b')!.amount).toBe(20);
    expect(out.find((o) => o.id === 'c')!.amount).toBe(20);
    expect(sum(out)).toBe(100);
  });

  it('pins penny remainder so the total equals the funded pot', () => {
    // pot = 100, three-way tie for 1st across places 1-3 (100%): 100/3 = 33.33 each → 99.99, +0.01 drift
    const cfg: PayoutConfig = { buyIn: 10, places: 3, splitMode: 'percent', split: [50, 30, 20] };
    const out = computePayouts(
      [
        { id: 'a', position: 1 },
        { id: 'b', position: 1 },
        { id: 'c', position: 1 },
      ],
      cfg,
      10
    );
    expect(sum(out)).toBe(100);
    // one entry carries the extra cent
    const amounts = out.map((o) => o.amount).sort();
    expect(amounts).toEqual([33.33, 33.33, 33.34]);
  });

  it('returns all-zero when nothing configured', () => {
    const cfg: PayoutConfig = { buyIn: 0, places: 1, splitMode: 'percent', split: [100] };
    const out = computePayouts([{ id: 'a', position: 1 }], cfg, 0);
    expect(sum(out)).toBe(0);
  });
});
