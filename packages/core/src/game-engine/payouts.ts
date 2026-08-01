import type { PayoutConfig } from '../types/game-payout';

export interface PayoutEntry {
  id: string;
  amount: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Distribute a game's pot across ranked entities (players OR teams — the engine
 * is entity-agnostic; `id` is a playerId or teamId).
 *
 * `ranked` carries each entity's finishing `position` (1-based; ties share the
 * same position, matching how the format engines emit standings). Returns the
 * money each entity wins (0 for entities outside the paid places).
 *
 * Ties: a tie group occupies consecutive rank slots; the funded shares for those
 * slots are pooled and split equally among the tied entities (standard golf tie
 * handling). Any rounding remainder in cents is pinned to the first paying entry
 * so the total paid out exactly equals the funded total.
 */
export function computePayouts(
  ranked: { id: string; position: number }[],
  payout: PayoutConfig,
  playerCount: number
): PayoutEntry[] {
  const result: PayoutEntry[] = ranked.map((r) => ({ id: r.id, amount: 0 }));
  if (!ranked.length || payout.places < 1 || !payout.split.length) return result;

  const { buyIn, places, splitMode, split } = payout;
  const pot = round2(buyIn * playerCount);

  // Dollars funded to a given (1-indexed) rank slot.
  const placeAmount = (slot: number): number => {
    if (slot < 1 || slot > places) return 0;
    const s = split[slot - 1] ?? 0;
    return splitMode === 'percent' ? (pot * s) / 100 : s;
  };

  const sorted = [...ranked].sort((a, b) => a.position - b.position);
  const byId = new Map(result.map((r) => [r.id, r]));

  // Walk tie groups (consecutive equal positions) across consecutive rank slots.
  let slot = 1;
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].position === sorted[i].position) {
      j++;
    }
    const groupSize = j - i + 1;
    let pooled = 0;
    for (let s = slot; s < slot + groupSize; s++) pooled += placeAmount(s);
    if (pooled > 0) {
      const each = round2(pooled / groupSize);
      for (let k = i; k <= j; k++) byId.get(sorted[k].id)!.amount = each;
    }
    slot += groupSize;
    i = j + 1;
  }

  // Correct rounding drift so Σ payouts == funded total.
  const funded = round2(
    Array.from({ length: places }, (_, k) => placeAmount(k + 1)).reduce(
      (a, b) => a + b,
      0
    )
  );
  const paid = round2(result.reduce((a, r) => a + r.amount, 0));
  const drift = round2(funded - paid);
  if (drift !== 0) {
    const firstPaid = sorted.find((r) => byId.get(r.id)!.amount > 0);
    if (firstPaid) {
      const e = byId.get(firstPaid.id)!;
      e.amount = round2(e.amount + drift);
    }
  }

  return result;
}
