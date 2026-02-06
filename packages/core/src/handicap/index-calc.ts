/**
 * WHS Handicap Index Calculation
 * Uses the best differentials from the most recent 20 rounds.
 *
 * Number of rounds | Differentials used
 * 3                | Lowest 1 - 2.0
 * 4                | Lowest 1 - 1.0
 * 5                | Lowest 1
 * 6                | Lowest 2 - 1.0
 * 7-8              | Lowest 2
 * 9-10             | Lowest 3
 * 11-12            | Lowest 4
 * 13-14            | Lowest 5
 * 15-16            | Lowest 6
 * 17-18            | Lowest 7
 * 19               | Lowest 8 - 1.0
 * 20               | Lowest 8
 */

interface DifferentialInput {
  roundId: string;
  differential: number;
  date: string;
}

interface HandicapIndexResult {
  handicapIndex: number;
  differentialsUsed: DifferentialInput[];
  numRounds: number;
}

const DIFFERENTIAL_TABLE: { maxRounds: number; count: number; adjustment: number }[] = [
  { maxRounds: 3, count: 1, adjustment: -2.0 },
  { maxRounds: 4, count: 1, adjustment: -1.0 },
  { maxRounds: 5, count: 1, adjustment: 0 },
  { maxRounds: 6, count: 2, adjustment: -1.0 },
  { maxRounds: 8, count: 2, adjustment: 0 },
  { maxRounds: 10, count: 3, adjustment: 0 },
  { maxRounds: 12, count: 4, adjustment: 0 },
  { maxRounds: 14, count: 5, adjustment: 0 },
  { maxRounds: 16, count: 6, adjustment: 0 },
  { maxRounds: 18, count: 7, adjustment: 0 },
  { maxRounds: 19, count: 8, adjustment: -1.0 },
  { maxRounds: 20, count: 8, adjustment: 0 },
];

function getTableEntry(numRounds: number): { count: number; adjustment: number } | null {
  if (numRounds < 3) return null;
  for (const entry of DIFFERENTIAL_TABLE) {
    if (numRounds <= entry.maxRounds) {
      return { count: entry.count, adjustment: entry.adjustment };
    }
  }
  // 20+ rounds
  return { count: 8, adjustment: 0 };
}

export function calculateHandicapIndex(
  differentials: DifferentialInput[]
): HandicapIndexResult | null {
  if (differentials.length < 3) {
    return null; // Need at least 3 rounds
  }

  // Take most recent 20
  const recent = [...differentials]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  const tableEntry = getTableEntry(recent.length);
  if (!tableEntry) return null;

  // Sort by differential (lowest first)
  const sorted = [...recent].sort((a, b) => a.differential - b.differential);
  const used = sorted.slice(0, tableEntry.count);

  const average =
    used.reduce((sum, d) => sum + d.differential, 0) / used.length;
  const adjusted = average + tableEntry.adjustment;

  // Truncate to one decimal (don't round)
  const handicapIndex = Math.floor(adjusted * 10) / 10;

  // Cap at 54.0 (WHS maximum)
  const capped = Math.min(handicapIndex, 54.0);

  return {
    handicapIndex: capped,
    differentialsUsed: used,
    numRounds: recent.length,
  };
}
