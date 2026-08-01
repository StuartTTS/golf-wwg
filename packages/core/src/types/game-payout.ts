// Payout configuration attached to a game (stored in games.config.payout).
// Generalizes the old single "wager per unit" into a real pot: every player
// antes `buyIn`, and the pot (buyIn × players) is split across the top `places`
// finishers using a Commish-entered split (percentages or dollar amounts).

export type PayoutSplitMode = 'percent' | 'amount';

export interface PayoutConfig {
  /** Per-player entry fee. Pot = buyIn × number of players. */
  buyIn: number;
  /** Number of finishing positions that get paid. */
  places: number;
  /** Whether `split` entries are percentages of the pot or flat dollar amounts. */
  splitMode: PayoutSplitMode;
  /** One entry per paid place. Percent entries sum to 100; amount entries ≤ pot. */
  split: number[];
}
