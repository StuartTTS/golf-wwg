import { describe, it, expect } from 'vitest';
import {
  calculateCourseHandicap,
  calculateCourseHandicapFull,
} from '../course-handicap';
import {
  calculateScoreDifferential,
  applyNetDoubleBogeyAdjustment,
  calculateAdjustedGrossScore,
} from '../differential';
import {
  calculatePlayingHandicap,
  calculateMatchPlayStrokes,
} from '../playing-handicap';
import { calculateHandicapIndex } from '../index-calc';

describe('calculateCourseHandicap', () => {
  it('applies Index * Slope / 113 and rounds to nearest whole', () => {
    // 10.0 * (125 / 113) = 11.06 -> 11
    expect(calculateCourseHandicap(10, 125)).toBe(11);
  });

  it('returns 0 for scratch on a standard slope', () => {
    expect(calculateCourseHandicap(0, 113)).toBe(0);
  });

  it('handles a plus (better-than-scratch) index', () => {
    // -2.4 * (130 / 113) = -2.76 -> -3
    expect(calculateCourseHandicap(-2.4, 130)).toBe(-3);
  });
});

describe('calculateCourseHandicapFull', () => {
  it('adds the (course rating - par) term', () => {
    // 10 * (125/113) + (71.2 - 72) = 11.06 - 0.8 = 10.26 -> 10
    expect(calculateCourseHandicapFull(10, 125, 71.2, 72)).toBe(10);
  });
});

describe('calculateScoreDifferential', () => {
  it('computes (113 / Slope) * (AGS - Rating) to one decimal', () => {
    // (113/125) * (90 - 71.2) = 0.904 * 18.8 = 16.995 -> 17.0
    expect(calculateScoreDifferential(90, 71.2, 125)).toBe(17);
  });

  it('throws when slope is zero', () => {
    expect(() => calculateScoreDifferential(90, 71.2, 0)).toThrow();
  });
});

describe('applyNetDoubleBogeyAdjustment', () => {
  it('caps a blow-up hole at par + 2 + strokes received', () => {
    // par 4, 1 stroke -> max 7; an 9 becomes 7
    expect(applyNetDoubleBogeyAdjustment(9, 4, 1)).toBe(7);
  });

  it('leaves a score at or below the cap unchanged', () => {
    expect(applyNetDoubleBogeyAdjustment(5, 4, 1)).toBe(5);
  });
});

describe('calculateAdjustedGrossScore', () => {
  it('sums per-hole net-double-bogey-adjusted strokes', () => {
    const holes = [
      { strokes: 9, par: 4, strokesReceived: 1 }, // capped to 7
      { strokes: 4, par: 4, strokesReceived: 0 }, // 4
      { strokes: 3, par: 3, strokesReceived: 0 }, // 3
    ];
    expect(calculateAdjustedGrossScore(holes)).toBe(14);
  });
});

describe('calculatePlayingHandicap', () => {
  it('applies the allowance percentage and rounds', () => {
    // 18 * 0.95 = 17.1 -> 17
    expect(calculatePlayingHandicap(18, 0.95)).toBe(17);
  });
});

describe('calculateMatchPlayStrokes', () => {
  it('gives the higher handicap the difference', () => {
    expect(calculateMatchPlayStrokes(20, 12, 1)).toEqual({
      player1Strokes: 8,
      player2Strokes: 0,
    });
  });

  it('gives none when handicaps are equal', () => {
    expect(calculateMatchPlayStrokes(12, 12, 1)).toEqual({
      player1Strokes: 0,
      player2Strokes: 0,
    });
  });
});

describe('calculateHandicapIndex', () => {
  const diffs = (values: number[]) =>
    values.map((differential, i) => ({
      roundId: `r${i}`,
      differential,
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    }));

  it('returns null with fewer than 3 rounds', () => {
    expect(calculateHandicapIndex(diffs([12, 15]))).toBeNull();
  });

  it('uses lowest 1 minus 2.0 for exactly 3 rounds', () => {
    // lowest of [20,18,22] = 18; 18 - 2.0 = 16.0
    const result = calculateHandicapIndex(diffs([20, 18, 22]));
    expect(result?.handicapIndex).toBe(16);
    expect(result?.differentialsUsed).toHaveLength(1);
  });

  it('averages the lowest 8 for 20 rounds', () => {
    // 20 diffs 10..29; lowest 8 = 10..17, avg = 13.5, adjustment 0
    const result = calculateHandicapIndex(
      diffs(Array.from({ length: 20 }, (_, i) => 10 + i))
    );
    expect(result?.numRounds).toBe(20);
    expect(result?.differentialsUsed).toHaveLength(8);
    expect(result?.handicapIndex).toBe(13.5);
  });

  it('caps the index at 54.0', () => {
    const result = calculateHandicapIndex(diffs([60, 61, 62, 63, 64]));
    expect(result?.handicapIndex).toBe(54);
  });

  it('truncates (does not round up) to one decimal', () => {
    // 5 rounds -> lowest 1; lowest of [12.38,...] uses floor to 1 decimal
    const result = calculateHandicapIndex(diffs([12.38, 20, 21, 22, 23]));
    expect(result?.handicapIndex).toBe(12.3);
  });
});
