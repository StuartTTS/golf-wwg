# Next Steps — Phase 1 wrap-up → Phase 2 prep

Living checklist for finishing Phase 1 (Type A "Tee It Up Now") and the work that
must land before Phase 2 (Type B "Game Time"). Companion to
`phase1-type-a-spec.md`, `round-confirmation-lock.md`, and `gameid-join-roles.md`.

---

## What's done (PR #6 — `feat/tee-it-up-solo`)

- [x] Migrations `00023_solo_play` (personal group + `round_type` + RPCs) and
      `00024_scorecard_confirmation` (three-tier confirm/lock) — **applied to the DB**.
- [x] `database.types.ts` regenerated; temporary casts removed.
- [x] Solo flow: `/tee-it-up` (course → tees → Start), `createSoloRound`,
      `getRecentCourses`, preferred-tee default.
- [x] Commish **Confirm round / Reopen** banner in the Play screen (`finalize_round` /
      `unfinalize_round`).
- [x] Action-centric **nav shell** behind `NEXT_PUBLIC_FEATURE_NAV_V2` (Start parent →
      modes, Join Game, Groups/Courses → Manage/More).
- [x] **Home action cards** sourced from `lib/nav-modes` (Tee It Up live; Game Time /
      Cup Time / Join Game as "Soon").
- Ships dark behind `NEXT_PUBLIC_FEATURE_PLAY_EXPERIENCE`, `NEXT_PUBLIC_FEATURE_TEE_IT_UP`,
  `NEXT_PUBLIC_FEATURE_NAV_V2`.

---

## Immediate: test Phase 1 end-to-end

Restart the dev server (env changed), then drive the real loop:

- [ ] Home → **Tee It Up Now** → pick course (recent list shows) → confirm tees →
      **Start** → lands in Play **Enter**.
- [ ] Enter scores + shot stats → **Confirm round** → round appears in `/profile/stats`.
- [ ] **Reopen** → edit a hole → **re-confirm** → stats reflect the correction.
- [ ] "Set as my default tees" persists to the next solo round.
- [ ] Nav shell + Home cards render on desktop **and** mobile (Start bottom sheet,
      Groups/Courses in More).

---

## Before Phase 2

### A. Phase 1 correctness (touches existing behavior — do before merge)

- [x] **`completeRound` → `finalize_round`.** Turned out there is **no live "Complete
      Round" button** — `completeRound`/`startRound` were dead code, and the only
      completion path is the Play **Confirm/Reopen** banner (`finalize_round`).
      Hardened `completeRound` to route through `finalize_round` so it can't
      reintroduce the direct-status bug if reused later.
- [x] **Non-scorer self-edit gate fixed.** The Play `enter` view now lets a player
      **always** enter and track their **own** card; a flight scorer owns everyone
      *else's* official card (per-player access, not a global lock). Banner reworded.
- [ ] **Verify existing group rounds** still score/complete under the new score-write
      RLS (locked-card enforcement, finalize gate) — covered by end-to-end testing.

### B. Logistics

- [ ] **Merge PR #6** into `enhancements` (owner review — large PR, worth a walkthrough).
- [ ] **Revoke the Supabase access token** (keys saved in local `.env.local`; token no
      longer needed).

### C. Phase 2 design sign-offs (needed before building Game Time)

- [ ] **Persistent roster** (`roster_players`) — the foundation for adding players to
      games and for the Commish to pre-build foursomes that joiners claim. Needs a
      schema design.
- [ ] **GameID subsystem** — authenticated-only, code-scoped join path (`share_code`
      on rounds + one new RLS rule) + role picker. Design in `gameid-join-roles.md`;
      needs final sign-off.
- [ ] **Games-list cleanup** — the create-game UI offers `stableford` /
      `bingo_bango_bongo` (no engine) and hides engines that exist (scramble,
      alternate-shot). Reconcile before Phase 2 builds on it.
- [ ] **Per-card / per-foursome confirm UI (tiers 1–2)** — only the Commish finalize
      (tier 3) is wired; group games need player self-confirm + foursome-scorer
      confirm. Likely the first Phase 2 task.
- [ ] **Dual scoring & discrepancy reconciliation** — let the official game score and
      a player's own tracked score differ (best-ball pickups), and surface mismatches
      **at confirmation time** (end of round), not live. Add the `player_strokes` +
      `picked_up` columns in Phase 2 core; reconcile UX rides on the confirm step. See
      `game-time-score-reconciliation.md`.

---

## Recommended order

1. **A1 + A2** (small; fix real inconsistencies Phase 2 depends on) →
2. **Test** Phase 1 (Immediate section) →
3. **Merge** PR #6 (B4) + revoke token (B5) →
4. **Phase 2 kickoff** starting with the **roster schema (C6)** — everything in Type B
   hangs off it.

---

## Deferred / not blocking

- Icons are placeholders (`Flag` / `Swords` / `Trophy` / `Ticket`); custom golf-tee SVG
  and swaps can come anytime.
- Mode naming ("Tee It Up Now / Game Time / Cup Time") kept as-is for now.
- **Cup model decision** (reuse vs rebuild; hole-segment → round mapping) — needed for
  Phase 3, not Phase 2. See `type-c-cup-notes.md`.
- Gate `finalizeGame` on `rounds.confirmed_at` so games settle only with the round.
