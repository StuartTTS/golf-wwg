# Joining by GameID — Role Selection

When a user enters a **GameID** to join a round/game, they choose how they want to
participate. This sits inside the (not-yet-built) **GameID subsystem**
(Phase 2 / Type B) and wires directly into the scoring + confirmation model
(`docs/round-confirmation-lock.md`).

> **What a GameID is (and isn't):** it's a code the app issues **after** the
> Commish has fully set up the round (field, foursomes, games), used only to join
> that already-configured game. It is **not** a pre-setup recruitment code (e.g.
> "who's in for Sunday? sign up with this code") — that idea is explicitly out of
> scope for now.

---

## Ground rule: no anonymous access

**Entering a GameID requires signing up / logging in first.** There is no
anonymous or public leaderboard path — every participant is a registered user, so
we always capture their email and profile details. Practical consequences:

- The GameID join path is **authenticated-only**, which removes the need for any
  anonymous/public RLS. The only new access rule is "an authenticated user who
  presents a valid code may become a `round_player` of that round, even if they're
  not in its group." Smaller, safer build than a public path.
- A person who joins is a real `profiles` row (not a guest). **Guests**
  (`user_id IS NULL`) remain only for people someone *else* scores who never touch
  the app — they never enter a GameID.
- Flow: **Sign in / Sign up → enter GameID → placed by the Commish → role picker.**

---

## The requirement

On join, present three options:

1. **Score for my foursome/group** — I keep the official score for my group.
2. **Track my own score + stats** — I record just my own card and detailed stats.
3. **Both** — I score for my group *and* track my own detailed stats.

---

## What each option sets

The three options are really **two independent flags**:

- `isGroupScorer` — am I the designated scorer for my foursome?
- `tracksOwnStats` — do I want my own detailed shot-stat entry surfaced?

| Choice | `isGroupScorer` | `tracksOwnStats` | Maps to |
|---|---|---|---|
| Score for foursome/group | ✅ | ➖ (quick strokes) | becomes `tee_time_groups.scorer_id` for their flight |
| Track own score + stats | ❌ | ✅ | self-tracker (self-scoring is always allowed) |
| Both | ✅ | ✅ | flight `scorer_id` **and** full personal stat panel |

Nothing new is needed in the data model beyond what already exists: a flight
scorer is `tee_time_groups.scorer_id`; a self-tracker just uses their own
`round_players` card. `tracksOwnStats` is a **UI preference** (which entry panel to
show) — persist it on the client, or optionally as a small column later; it does
**not** affect authority, because under the confirmation model **a player may
always edit and confirm their own card** regardless.

---

## How it ties to confirmation (tiers)

- **Score for foursome** → this person confirms the **foursome** (tier 2,
  `confirm_flight`).
- **Track own** → this person confirms **their own card** (tier 1,
  `confirm_scorecard`).
- **Both** → they do both — one confirm for the foursome, and their own card is
  part of that flight.
- The **Commish** still gives the final game sign-off (tier 3, `finalize_round`)
  regardless of anyone's join role.

So "Both" is not a special authority — it's "I took the scorer job *and* I want my
own stat panel." A scorer can always enter their own detailed stats; this choice
just surfaces that UI for them.

---

## Join flow (sketch)

```
Sign in / Sign up ─► enter GameID ─► validate code ─► placed into the
                                     Commish-assigned foursome (or an
                                     "unassigned" pool for the Commish to slot)
                                        │
                                        ▼
                        "How do you want to play?"
                         ┌──────────────┬──────────────────┬───────────┐
                         │ Score for    │ Track my own     │ Both      │
                         │ my group     │ score + stats    │           │
                         └──────┬───────┴─────────┬────────┴─────┬─────┘
                                │                 │              │
                 claim flight scorer_id     self-track only   scorer + stats
                                │                 │              │
                                ▼                 ▼              ▼
                        round_player confirmed in their foursome; Play opens
```

The joiner picks their **role**, but never their **foursome** — the Commish owns
pairings.

After placement, the joiner also gets an optional **"Add your playing partners to
your roster?"** prompt (opt-in) — the primary way personal rosters get populated
without manual entry. See `roster-design.md`.

---

## Edge cases / open decisions

1. **One scorer per foursome.** `tee_time_groups.scorer_id` is a single FK. If two
   joiners both pick "Score for my group," **first-claim-wins** (default): the
   second sees *"Alex is scoring your group"* and can only self-track; the Commish
   can reassign. Allowing multiple co-scorers per foursome would need a schema
   change (`flight_scorers` join table) — flagged, not assumed.
2. **Foursome assignment is the Commish's, not the joiner's.** Many games depend
   on who is in which foursome, so the **Commish sets the pairings** — joiners do
   not self-select. A joiner either **claims a Commish-created slot** (matched to
   them by email/identity) or lands in an **"unassigned" pool** the Commish then
   drags into a foursome. The role picker (scorer / self-track / both) is still the
   joiner's choice; the *placement* is the Commish's.
3. **Non-member joiners (authenticated).** Joining by code makes an
   **authenticated** user a `round_player` of a round whose group they may not
   belong to. Because there is no anonymous access (see *Ground rule*), the only
   new RLS is a **code-scoped, authenticated path** — no public/anonymous policy.
   This is still the core access change the GameID subsystem carries; tracked with
   the GameID work.
4. **Changing your mind.** A joiner should be able to switch role later (drop the
   scorer job, or start tracking stats) without rejoining — a simple toggle on
   their Play screen, subject to the one-scorer rule.
5. **Default option.** Recommend defaulting the picker to **"Track my own score +
   stats"** (the safe, most common case) so a tap-through doesn't accidentally
   claim the scorer job.

---

## Status

Design note only. Depends on the **GameID subsystem** — a **code-scoped,
authenticated-only** access path (no public/anonymous access; everyone signs up),
which is the main greenfield build of Phase 2. This role picker is a requirement
*for* that flow.
