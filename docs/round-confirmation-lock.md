# Round Confirmation & Lock/Unlock

How a round gets attested, finalized, locked from edits, and reopened for
corrections. Applies to **all** rounds (solo, game, cup). Migration:
`00024_scorecard_confirmation.sql`.

---

## The core idea: two things get confirmed on the same card

In a typical group round there are **3 foursomes**, each with a **scorer** who
keeps the official game score for their group. But a non-scorer in a foursome may
*also* want to track their own score/stats — and they should be able to. So a
single scorecard carries two overlapping concerns:

- the **official game score** (drives the leaderboard/payouts), owned by the
  foursome scorer, and
- the player's **own score/stats**, which the player can enter and attest
  themselves.

Both write to the same player's card. Confirmation is therefore **tiered**, not a
single lock.

---

## Three tiers of confirmation

| Tier | Who confirms | What it means | Data |
|---|---|---|---|
| **1. Scorecard** | the **player** (their own card, always), the **flight scorer**, the **scorekeeper**, or **Commish/admin** | "this player's score/stats are done & attested" — locks that card | `round_players.confirmed_at` / `confirmed_by` |
| **2. Foursome** | the **flight's scorer** (or Commish) | scorer attests the official scores for their foursome (bulk-confirms the flight's cards) | `confirm_flight()` over tier 1 |
| **3. Game** | the **Commish** (creator), group admin, or round scorekeeper | **final sign-off** — the game is settled and the round counts | `rounds.confirmed_at` / `confirmed_by` |

**Key rule (the fix):** a player can **always** confirm/unlock their *own* card —
even inside a scorer-led foursome. Being a non-scorer never locks you out of
tracking and attesting your own stats.

**A round counts only when the Commish finalizes it** (tier 3). `status='completed'`
is derived purely from `rounds.confirmed_at`. Tiers 1–2 attest and lock individual
cards but do **not** by themselves make the round count — the Commish is the gate.

For a **solo** round the player *is* the Commish and the only card, so "Confirm"
is a single tap = `finalize_round` (auto-confirms their card).

---

## Flow

```
players self-confirm own cards ──┐
foursome scorer confirms flight ─┼─►  Commish reviews  ──►  finalize_round()
                                 │      "3 of 3 foursomes in"      │
                                 │                                 ▼
                                 │                 rounds.confirmed_at set
                                 │                 status = 'completed'
                                 │                 → counts in stats + game settled
                                 └───────────────────────────────────────
correction needed →  Commish unfinalize_round()  →  unlock the specific card
                     →  edit  →  re-confirm card  →  finalize again
```

Because stats/handicap filter `status='completed'`, unfinalizing a round pulls it
out of stats until the Commish finalizes again — automatically, no extra flag.

---

## Server API (RPCs, all `SECURITY DEFINER`)

| Function | Who may call | Effect |
|---|---|---|
| `confirm_scorecard(round_player_id)` | self, flight scorer, scorekeeper, Commish/admin | lock one card |
| `unlock_scorecard(round_player_id)` | same set (mirror) | reopen one card |
| `confirm_flight(tee_time_group_id)` | that flight's scorer, or Commish/admin | confirm all cards in the foursome |
| `finalize_round(round_id)` | Commish/admin, or round scorekeeper | auto-confirm stragglers + stamp round → `completed` |
| `unfinalize_round(round_id)` | Commish/admin, or round scorekeeper | reopen the game (cards stay locked until individually unlocked) |

Authority lives in two helpers so the UI never re-implements it:
`can_manage_scorecard(card, user)` (tier 1) and `can_finalize_round(round, user)`
(tier 3). Call the RPCs from thin server actions in
`apps/web/src/lib/actions/rounds.ts` via `supabase.rpc(...)`.

**Locking is enforced at the DB (RLS), not just the UI:** a score write is
rejected when the round is finalized OR the target card is confirmed. So a
confirmed card genuinely can't be edited until unlocked — even by someone with
scoring rights.

---

## Lock/unlock UX (must be "straightforward")

- **Non-scorer, self-tracking:** their own card is fully editable and shows a
  **"Confirm my scorecard"** button. (The Play `enter` tab must let a non-scorer
  edit *their own* stats even when the foursome has a scorer — today it renders
  read-only; that gate needs to allow self-edit.)
- **Flight scorer:** a **"Confirm foursome"** button (`confirm_flight`) on their
  group's card.
- **Commish:** a round banner — "Foursomes confirmed: 2 / 3" — and a **"Finalize
  round"** button (`finalize_round`). After finalizing, a **"Reopen"** control
  (`unfinalize_round`).
- **Locked card:** lock badge + disabled inputs; authorized users see **"Unlock to
  edit"** right on the card. One tap to correct.
- **Post-finalize:** route to stats / game summary so numbers update immediately.

---

## Interactions to fix when building

- **`completeRound` is superseded** by `finalize_round`. It currently sets
  `status='completed'` directly, bypassing the confirmation gate — refactor the
  round-detail "Complete Round" button to call `finalize_round`. Keep `startRound`
  (upcoming → in_progress).
- **Existing shot-stat read-only gate:** the Play `enter` view currently makes
  non-scorers read-only when a flight scorer is set. Relax it so a player can
  always edit **their own** card (their strokes/stats), while the scorer still
  owns everyone else's.
- **Games/payouts:** finalize `finalizeGame` only once `rounds.confirmed_at` is set
  (game settles with the round). Follow-on, not required for the score lock.
- **Guests** (`user_id IS NULL`) never self-confirm; their card is handled by the
  scorer/Commish — covered by the authority rules.

---

## Verification checklist

1. Foursome with a scorer + one self-tracker: the self-tracker can edit and
   **Confirm my scorecard**; the scorer can **Confirm foursome**; neither blocks
   the other.
2. Self-tracker's own card locks on their confirm; they can **Unlock** it, fix a
   stat, and re-confirm — without the scorer's involvement.
3. Round does **not** count until the **Commish** `finalize_round`s it, even when
   all foursomes are confirmed.
4. `finalize_round` auto-confirms any open cards and flips `status='completed'` →
   round appears in stats/handicap and the game settles.
5. Locked card: a raw score `upsert` is rejected by RLS (not just hidden).
6. `unfinalize_round` → round drops from stats; unlock a card → edit → re-confirm →
   finalize → returns with the correction.
7. Solo: one **Confirm** (= finalize) → appears in `/profile/stats`; reopen →
   drops; finalize → returns.
