# Game Time — Dual Scoring & Discrepancy Reconciliation

A Phase 2 (Type B "Game Time") feature: let a foursome's **official game score**
and a player's **own tracked score** differ, then reconcile any mismatch **at
confirmation time** (end of round), not live during play. Companion to
`round-confirmation-lock.md` and `gameid-join-roles.md`.

---

## The problem

In Game Time there's a **foursome scorer** keeping the official card for the
group, while some players **track their own score + stats**. The two legitimately
diverge — most commonly a **best-ball pickup**: once a partner has the low score
that counts, the scorer gives the player an **"X"** on the official card, but the
player still wants their **actual strokes + stats** for their personal record.

Today there is **one score value per player per hole**, so the scorer and the
self-tracker overwrite each other (last write wins). Accurate personal stats in a
game format are impossible. Fixing this is a genuine differentiator.

---

## Two scoring "lanes"

Each player+hole can hold two values that are *allowed* to differ:

| Lane | Drives | Owned by | Notes |
|------|--------|----------|-------|
| **Game score** (official) | leaderboard / payouts | the foursome scorer (or self, if self-scoring) | may be a pickup / "X" |
| **Personal score** (actual) | that player's stats & handicap | the player | keeps detailed stats coherent |

By default both lanes hold the same number — most holes only one person enters, or
they agree. They diverge only when a self-tracker records something different from
the official card.

Divergence happens two ways, and the feature serves both:
1. **Legitimate** — best-ball pickup (official `X`, personal actual). Both correct → **keep both**.
2. **Mistake** — official `5`, personal `6`, a mis-tap → **reconcile to match**.

So the discrepancy check both preserves intentional splits **and** catches
data-entry errors.

---

## When discrepancies surface: at CONFIRMATION, not live

> **Design rule:** during the round, both lanes are recorded **silently** — no
> live banners, no nagging. Discrepancies are surfaced **only at end of round,
> when a user is confirming scores.**

This rides on the existing confirmation tiers (`round-confirmation-lock.md`):

- When the **player** goes to confirm their own card (tier 1), or the **foursome
  scorer** confirms the foursome (tier 2), the confirm step first shows a
  **review list** of holes where official ≠ personal (excluding marked pickups).
- For each flagged hole the confirming party chooses **Keep both** (accept the
  split — the X case) or **Sync** (pick one value for both).
- A card **cannot be confirmed while it has unreviewed discrepancies** — so
  confirmation is the single, natural chokepoint that guarantees every mismatch is
  seen and consciously resolved before the round finalizes.
- The **Commish finalize** (tier 3) can still see a summary of any accepted splits.

Both the player and the scorer thus get their moment to review — at the point
they're already stopping to sign off — instead of being interrupted mid-round.

---

## Data model

**Option A — two columns on the existing `scores` row (recommended).**
- Keep `strokes` as the **official/game** value; add **`player_strokes`**
  (personal actual) and a **`picked_up`** boolean.
- Game engine reads `strokes`; stats read `player_strokes ?? strokes`.
- Detailed stats (fairways, GIR, putts) already live on this row, so they stay
  coherent with the personal score.
- Ownership enforced in `upsertScore` by role: the scorer writes `strokes`
  (+ `picked_up`); the player writes `player_strokes` + detailed stats. In pure
  self-scoring (no foursome scorer) a single entry sets both.
- **Discrepancy** = `strokes` and `player_strokes` both set, not equal, and
  `picked_up = false`.

**Option B — two score rows** distinguished by a `scope` (`game` vs `personal`).
Purer separation of authorship, but needs unique-constraint changes and touches
the game engine + stats queries to pick the right scope. Heavier.

→ Recommend **A**.

---

## Nuances

- **Low-friction default:** a discrepancy only exists when *both* lanes are filled
  and differ. Solo / self-scored rounds and holes only one person touched never
  flag anything.
- **Handicap posting:** a pickup "X" must **not** post to handicap as X — USGA
  posts *Net Double Bogey / most-likely-score*. Stats use the actual; handicap
  posting applies the cap. Refinement, not core, but don't post an "X."
- **Best-ball engine:** already treats a picked-up player as contributing nothing
  to the team, so marking the official lane `picked_up` is sufficient; the personal
  lane just rides alongside for stats.

---

## Scope

Phase 2 (Game Time) — it only matters when a **group scorer** and a **self-tracker**
both exist, which is exactly Type B.

- **Schema (the `player_strokes` + `picked_up` columns): add in Phase 2 core** —
  cheap, and everything else depends on it.
- **Reconcile-at-confirmation UX: core or immediate fast-follow** once the basic
  Game Time flow works.

## Open decisions

- Confirm **Option A vs B** (recommended A).
- "Keep both" vs "Sync" wording, and whether **Sync** defaults to the official or
  the personal value.
- Whether the Commish finalize shows only a **count** of accepted splits or the
  full per-hole list.
