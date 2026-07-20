# Type C — "Cup Time" (Ryder Cup) Implementation Notes

Plain-language explanation of *why* Type C is a bigger build than Types A/B, and
the one design decision we need to settle before building it.

> **Context:** Type C is a low-frequency event (once or twice a year) but high
> value — it keeps a group from leaving for another app to run their tournament.
> So it's worth building well, but it is **not** the near-term priority (Type A
> is most common, Type B second).

---

## The issue in one sentence

The app today can only reason about **one round at a time**, but a Ryder Cup is a
**container that sits *above* many rounds/games** — it keeps the *same teams*
across all of them and rolls every match's points into *one* overall winner.
That "container above a round" does not exist in the data model yet.

---

## Why A and B are easy but C is not

Types A and B reuse things that already exist:

- **Scoring + shot stats** — the Play experience (done)
- **Games** (skins, best ball, match play, alternate shot…) — 14-format engine (done)
- **Foursomes, tees, leaderboards** — existing round components (done)

Type A and B each live **inside a single round**. That is exactly how the whole
app is currently shaped:

```
Round  (one day of golf)
 ├─ Players
 ├─ Scores
 └─ Game (skins / best ball / …)
      └─ Teams   ← teams only exist INSIDE one game, inside one round
```

A Cup breaks that shape. It needs:

```
CUP  (the tournament)                         ← NEW: nothing spans rounds today
 ├─ Teams (2–4, named)                         ← persist across the WHOLE cup
 ├─ Matches                                    ← each = 9 or 18 holes, its own format
 │    • Front 9  → 2-man best ball
 │    • Back 9   → 2-man alternate shot
 │    • Last 18  → singles match play
 │       └─ Pairings drawn from the teams
 └─ Points ledger  (1 win / 0.5 tie / 0 loss)  ← rolls up ALL matches → cup winner
```

Three things here have **no home** in the current schema:

1. **A container above the round** — the only thing that spans rounds is
   `seasons`, and nothing even links to it. There is no "tournament/event/cup."
2. **Teams that persist across many games** — today `game_teams` lives inside a
   single game inside a single round; a cup needs the same two teams to carry
   through every match.
3. **Points aggregated across matches** — nothing today sums results from
   multiple games into one standing.

So Type C is not "a harder screen" — it's a **new structural layer** under which
the existing round/game machinery gets reused.

**Good news:** the hard part — *scoring each individual match* — is already done.
`match_play`, `best_ball_2`, `alternate_shot`, etc. already compute who won a given
match. The new work is the **orchestration layer** that ties matches into a cup
and tallies points, not new scoring logic.

---

## The decision: reuse vs. rebuild

**How should the Cup relate to the existing round/game system?**

### Option 1 — Cup as a thin aggregator over existing rounds/games  ✅ recommended

A `cup` is a new record that **references regular rounds and games**. Each match in
the cup is just a normal `game` row (so it reuses every game engine, the scoring
UI, leaderboards, and shot stats for free), tagged with which cup / team / hole-
segment it belongs to. The cup layer adds only: persistent teams, pairing
assignments, and a points tally.

- **Pro:** Maximum reuse — scoring, stats, leaderboards, payouts all "just work"
  because each match *is* a normal game. Far less new code.
- **Con:** We must define how a hole-segment (e.g. "front 9") maps onto a round
  (see the follow-on question below).

### Option 2 — Cup as its own self-contained system

Dedicated cup tables that own their own matches and scores, independent of the
round/game system.

- **Pro:** Model matches the Ryder Cup mental model exactly.
- **Con:** Massive duplication — we'd rebuild scoring, leaderboards, stats, and
  payouts that already exist. Roughly double the work and two code paths to keep
  in sync forever.

**Recommendation: Option 1.** Reuse the machinery we already trust; the cup is a
lightweight layer on top.

---

## The follow-on question (needs your input)

If we go with Option 1, we have to answer one concrete thing, because the vision
mixes formats like *"27 holes = three 9-hole matches"* and *"54 holes = three
18-hole matches"*:

> **How does a "match segment" map to a "round of golf"?**

Two natural interpretations:

- **(a) One round, subdivided.** An 18-hole round = two 9-hole matches (front =
  best ball, back = alternate shot). Everyone plays one continuous round; the cup
  splits it into segment-matches. Fits "front 9 / back 9 / last 18" phrasing.
- **(b) Separate rounds per match.** Each match is its own round (its own course,
  day, tee time). Fits multi-day events better.

The cleanest answer is usually **"a match is defined by a hole-segment, and one or
more matches can share a physical round."** That supports both — front/back on the
same day *and* matches on different days — but I want to confirm that's the
behavior you expect before modeling it.

Related smaller confirmations:
- Teams: cap at **4** for now (per the draft), each with a custom name. ✅
- Every player plays in every match (draft's stated assumption). ✅ — confirm.
- Points: **1 / 0.5 / 0**, most points wins the cup. ✅ — confirm this is fixed,
  or configurable per cup.

---

## Rough data shape (illustrative — not final)

```
cups          (id, name, owner, num_holes[mult of 9], teams_config, points_config, status)
cup_teams     (id, cup_id, name, team_order)
cup_team_players (cup_team_id, roster_player_id | user_id)
cup_matches   (id, cup_id, segment_order, hole_segment[front9|back9|full18|…],
               format_id, round_id → rounds, game_id → games)   ← reuses round+game
cup_pairings  (id, cup_match_id, cup_team_id, player_id)         ← who plays whom
cup_points    (id, cup_id, cup_match_id, cup_team_id, points)    ← rolls up → standings
```

Everything below `round_id` / `game_id` is **existing** infrastructure. The cup
tables are the only new surface.

---

## What this does NOT require

- New scoring or shot-stat logic — reuses the Play experience.
- New game formats — `match_play`, `best_ball_*`, `alternate_shot`, etc. exist.
- New leaderboard rendering — reuses `LeaderboardView` per match.

The build is: **cup tables + a setup/navigation wizard + a points-aggregation
view.** Significant, but additive and low-risk to the rest of the app.

---

## Note: this is a *different* decision from the Type A/B "group model" question

Don't conflate the two:

- **Group model decision** — affects how casual Type A/B rounds exist without
  group ceremony (implicit personal group vs. nullable `group_id`). Not a Cup issue.
- **Cup model decision** (this doc) — reuse vs. rebuild for the tournament layer.

They can be decided independently and in that order (A/B first, Cup later).
