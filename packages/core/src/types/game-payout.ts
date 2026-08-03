// Payout configuration attached to a game (stored in games.config.payout).
// Generalizes the old single "wager per unit" into a real pot: every player
// antes `buyIn`, and the pot (buyIn × players) is split across the top `places`
// finishers using a Commish-entered split (percentages or dollar amounts).

export type PayoutSplitMode = 'percent' | 'amount';

/** How to round each computed payout to a cash-friendly amount. */
export type PayoutRoundingMode = 'nearest' | 'up' | 'down';

export interface PayoutRounding {
  /** Round each payout to a multiple of this many dollars (e.g. 5 or 10). */
  increment: number;
  /** Round to the nearest multiple, or always up / always down. */
  mode: PayoutRoundingMode;
}

export interface PayoutConfig {
  /** Per-player entry fee. Pot = buyIn × number of players. */
  buyIn: number;
  /** Number of finishing positions that get paid. */
  places: number;
  /** Whether `split` entries are percentages of the pot or flat dollar amounts. */
  splitMode: PayoutSplitMode;
  /** One entry per paid place. Percent entries sum to 100; amount entries ≤ pot. */
  split: number[];
  /**
   * Optional: round each computed payout to a cash-friendly increment (e.g. up
   * to the nearest $5). Off when absent or `increment` ≤ 0. Rounding is applied
   * after the pot is split, so the total paid may not exactly equal the pot.
   */
  rounding?: PayoutRounding | null;
}
