# Shot Stats, Roles (Commish/Player/Scorer) & Three Phone Views

**Date:** 2026-07-16
**Branch:** `enhancements`
**Status:** In progress

## Goal

1. Capture PGA-style, hole-level shot stats (fairway/green miss direction, bunkers, penalties) tuned for **amateur** golfers, so the data can later feed a Claude-generated round summary + practice drill.
2. Split the experience into a **Commish** (setup/config) role and a **Player** experience.
3. Give players three phone-optimized views: **Leaderboard**, **Group Scorecard**, and **Score Entry**.

## Roles & terminology (locked)

| Term | What it is | How it's modeled |
|---|---|---|
| **Commish** | The person who set up the round/game. Setup only: assign players to flights, choose games, gross vs net, handicap %. | `rounds.created_by` (extensible to co-Commish later). Not a separate account — a capability on a person who is usually also playing. |
| **Player** | Everyone playing. Gets the 3-tab shell. | `round_players` |
| **Scorer** | A player a flight delegates to enter the flight's scores. Per-flight, optional. | `tee_time_groups.scorer_id` (nullable). Null = shared self-scoring within the flight. |

## Scope hierarchy (existing schema)

- `rounds` = the event ("game/tournament")
- `tee_time_groups` (00017) = playing groups / flights within a round; `round_players.tee_time_group_id` assigns players
- `scores` hang off `round_players`; RLS (00017) already lets a user score for players in their own tee-time group

## Three views (bottom tab bar, phone-first)

| View | Scope | Notes |
|---|---|---|
| **Leaderboard** | Whole round — all flights | gross + net + "thru X". Side-game (skins/nassau) standings later. |
| **Group Scorecard** | The user's tee-time group only | read-optimized card |
| **Enter** | The user's flight | dense phone-optimized capture screen |

## Stats capture (locked — amateur-tuned)

Rule of thumb: capture only what changes the **drill** Claude would prescribe. Four "strokes-gained" buckets — tee, approach, short game, putting.

**Captured per hole:**
- **Fairway:** hit / miss **Left** / miss **Right** (par 4/5 only). No "long/through."
- **Green:** GIR, or miss **Short / Long / Left / Right** (4-direction, no diagonals).
- **Putts**
- **Up & Down** (existing)
- **Bunker:** fairway bunker + greenside bunker (two flags)
- **Penalty strokes**

**Auto-derived (no taps):** GIR (`strokes − putts ≤ par − 2`, override allowed), sand save (greenside bunker + up-and-down), 3-putt (putts ≥ 3).

**Not captured:** 9-zone green grid, fairway "long," per-shot club/distance/lie — too much entry friction / self-report noise for amateurs; doesn't refine a drill.

## Scorer-only stats rule (locked)

When one person scores the whole flight, they can record everyone's **number** but not each partner's ball flight. Therefore:

- **strokes** → entered by the scorer for **every** player in the flight
- **all detailed stats (putts + FIR + fairway miss + GIR + green miss + bunkers + penalties)** → captured **only on the entering user's own card**

No schema change needed — stat rows are already keyed per `round_player`; the UI simply only renders the stat grid on the entering user's own row. When players self-score, everyone naturally gets their own full stats.

## Data model changes

### Migration `00022_shot_stats_and_scorer.sql`
- `scores`: add `fairway_miss TEXT CHECK IN ('left','right')`, `green_miss TEXT CHECK IN ('short','long','left','right')`, `fairway_bunker BOOLEAN`, `greenside_bunker BOOLEAN`, `penalties INT CHECK 0..10`.
- `tee_time_groups`: add `scorer_id UUID REFERENCES profiles(id) ON DELETE SET NULL`.

### Gross/net + handicap %
No schema change — stored per-game in the existing `games.config` JSONB as `{ scoring: 'gross'|'net', handicapAllowance: 100 }`. Different games in a round can score differently.

## Build phases

1. ✅ **Data + domain foundation** — migration `00022`, core types, validation, stats calculator.
2. ✅ **Backend** — `upsertScore`/`batchUpsertScores` accept the new fields; `updateGameScoring` + `setFlightScorer` actions.
3. ✅ **Phone shell** — new `/rounds/[id]/play` route, 3-tab bottom nav.
4. ✅ **Score-entry screen** — strokes-for-all + own-card stat grid, auto-GIR.
5. ✅ **Leaderboard & Group Scorecard** views.
6. ✅ **Commish config** — new `/rounds/[id]/setup` route: per-game gross/net + handicap %, per-flight scorer designation. Gated to round creator / group admin.
7. **(Later)** Claude round summary + drill from the captured stats.

## Feature flag

The whole Play experience ships **dark** behind `NEXT_PUBLIC_FEATURE_PLAY_EXPERIENCE`
(`apps/web/src/lib/feature-flags.ts`), default off:
- `/play` and `/setup` `notFound()` when the flag is off.
- Round-detail page shows the original "Enter Scorecard/Scores" buttons when off;
  "Play Round" / "Commish Setup" only appear when on.
- The migration + backend additions are unflagged (additive, nullable columns /
  uncalled actions — inert while the UI is hidden).

Enable in dev: add `NEXT_PUBLIC_FEATURE_PLAY_EXPERIENCE=true` to `apps/web/.env.local`.

## Config field conventions (important)

Gross/net + allowance align with the existing game engine, which reads:
- `games.config.useNet` (boolean, default true) — net vs gross
- `games.config.handicapAllowance` (fraction, e.g. `0.8` = 80%)

These are edited per-game on the Commish setup page.

## Implemented files (increments 1–3)

- Migration: `supabase/migrations/00022_shot_stats_and_scorer.sql`
- Core: `packages/core/src/types/{database,stats}.ts`, `validation/index.ts`, `stats/calculator.ts`
- Generated types: `apps/web/src/lib/supabase/database.types.ts`
- Actions: `lib/actions/scores.ts` (stat fields), `games.ts` (`updateGameScoring`), `rounds.ts` (`setFlightScorer`)
- Play route: `app/(dashboard)/rounds/[roundId]/play/{page,play-view}.tsx`
- Play components: `components/play/{shared.ts,leaderboard-view,group-scorecard-view,score-entry-view}.tsx`
- Setup route: `app/(dashboard)/rounds/[roundId]/setup/{page,setup-view}.tsx`
- Entry points: round detail page (`Play Round`, `Commish Setup` buttons)

## Quality gates

- `npm run type-check` before marking frontend tasks complete
- `npx supabase db reset` to test the migration locally
- Verify RLS still covers the new columns (columns inherit the existing `scores` row policies; no new policy needed)
