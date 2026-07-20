# Phase 1 Spec — Type A: "Tee It Up Now" (Solo Score & Track)

**Goal:** the most common user — someone who just wants to track their own score
and stats — can, in 2 taps from Home, pick a course, confirm their tees, and be
dropped straight into the existing Play scoring screen. No group, no invites, no
wizard.

**Status:** ready to build. Migration `00023_solo_play.sql` is included.
**Feature flag:** ships dark behind `NEXT_PUBLIC_FEATURE_TEE_IT_UP` (see §7).

---

## 1. Decisions locked

| Decision | Choice | Why |
|---|---|---|
| Group model | **Implicit personal group** (Option A) | `rounds.group_id` stays `NOT NULL`; every existing group-gated RLS policy works unchanged. A solo round hangs off an auto-provisioned "personal" group the user never sees. Zero RLS rewrite. |
| Round lifecycle | Solo round is created **already `in_progress`** | No "upcoming/RSVP" stage for a solo round — go straight to scoring. |
| Scoring | Reuse the **Play experience** (`/rounds/[id]/play`) | Shot-stat entry, leaderboard, realtime all already built. Type A adds only an *entry flow* in front of it. |
| Tees | Default from `profiles.default_tee_tier`, editable at start | Primitive + tier-matching logic already exist (`acceptRoundInvite`). |
| Dependency | Requires the Play flag too | Type A lands in the Play screen; the entry point only shows when both flags are on. |

This is **independent** of the Type C "Cup model" decision and the eventual
join-code work — nothing here blocks or is blocked by those.

---

## 2. User flow

```
Home  ──[ Tee It Up Now ]──►  /tee-it-up
                                 │
   Step 1: Pick course           │  • "Recently played" list first (§4 getRecentCourses)
                                 │  • Search + Import (reuse CourseSearchPanel) if not listed
                                 ▼
   Step 2: Confirm tees          │  • Preferred tee (default_tee_tier) pre-selected
                                 │  • Optional "Set as my default" checkbox → updates profile
                                 ▼
        [ Start Round ]  ──►  createSoloRound()  ──►  redirect
                                 ▼
        /rounds/[id]/play?tab=enter   (existing Play experience)
                                 │  play holes, enter scores + shot stats
                                 ▼
        [ Confirm round ]  ──►  finalize_round()  ──►  /profile/stats
                                 (solo player = Commish; status='completed' → stats)
                                 │
                                 └─ [ Reopen / Unlock to edit ] → correct → re-confirm
```

Two taps to scoring when a recent course + preferred tee exist (course tile →
Start). **The Confirm step is required** — a solo round is invisible to stats until
confirmed (see §3a and `docs/round-confirmation-lock.md`).

---

## 3. Data model changes — `00023_solo_play.sql`

Already written. Summary:

- **`groups.is_personal BOOLEAN NOT NULL DEFAULT false`** + partial unique index
  `idx_groups_one_personal_per_user (created_by) WHERE is_personal` — one
  personal group per user.
- **`rounds.round_type TEXT DEFAULT 'group' CHECK IN ('group','solo')`** — marks
  solo rounds (used by Home filtering & recent-courses).
- **`idx_rounds_created_by_date (created_by, round_date DESC)`** — recent lookups.
- **`get_or_create_personal_group()`** — `SECURITY DEFINER` RPC returning the
  caller's personal group id, creating it (+ admin membership) on first use.
  Idempotent.
- **`handle_new_user()`** extended (preserving the 00002 `search_path` fix) to
  seed a personal group for new signups.
- **Backfill** — personal groups for all existing users.

No changes to `scores`, `round_players`, or any RLS policy. A solo round's single
`round_player` (the user) satisfies the existing shared-mode score policies.

---

## 3a. Cross-round stats — solo rounds MUST be completed

The existing stats view (`profile/stats/page.tsx`) already aggregates across **all**
rounds a user has played, with **no group scoping** — it queries `scores` filtered
only by `player_id = auth.uid()` and `rounds.status = 'completed'`. There is no
group or round_type filter. **Therefore solo and group rounds unify automatically**
in stats, handicap history, and trends — the implicit-personal-group model does not
fragment them. No stats query change is needed.

**The one requirement this creates:** a solo round only appears in stats once its
`status = 'completed'`. Per the **Confirm/Lock model** (see
`docs/round-confirmation-lock.md`, migration `00024`), `status='completed'` is now
*derived* — a round is complete exactly when all its scorecards are confirmed.

For a solo round this collapses to a single tap: the player **is** the Commish and
the only scorecard, so tiers 1–3 happen at once via **`finalize_round`**:

- The solo Play flow exposes a **"Confirm round"** action → thin `finalizeRound`
  server action → `supabase.rpc('finalize_round', { p_round_id })`. This
  auto-confirms the player's card and stamps `rounds.confirmed_at` →
  `status='completed'` → it counts in stats.
- Finalizing **locks** the card (RLS blocks further score writes); a **"Reopen /
  Unlock to edit"** affordance calls `unfinalize_round` + `unlock_scorecard` so the
  solo player can fix a mistake — the round drops from stats until re-finalized.
- Route to `/profile/stats` on confirm so the numbers update immediately.
- Scores are written with `player_id` set for the solo (registered) user — only
  guests use the null-`player_id` / `round_player_id` path, and the solo user is
  never a guest.

> Do **not** use the old `completeRound` action — it sets status directly and
> bypasses the confirmation gate. Solo uses the same `finalize_round` RPC as every
> other round (see `docs/round-confirmation-lock.md`). Without the Confirm step a
> solo round scores fine but is invisible to stats/handicap — the most likely "why
> don't my stats update?" bug. Part of the Phase-1 definition of done.

---

## 4. Server actions  (`apps/web/src/lib/actions/`)

### `createSoloRound` — new, in `rounds.ts`

```ts
export async function createSoloRound(input: { courseId: string; teeBoxId: string }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createSoloRoundSchema.safeParse(input);      // §6
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  // 1. Resolve (or lazily create) the caller's personal group.
  const { data: groupId, error: gErr } =
    await supabase.rpc('get_or_create_personal_group');
  if (gErr || !groupId) return { error: 'Could not start round' };

  // 2. Handicap from profile + selected tee slope (same math as createRound).
  const [{ data: profile }, { data: teeBox }] = await Promise.all([
    supabase.from('profiles').select('current_handicap_index').eq('id', user.id).single(),
    supabase.from('tee_boxes').select('slope_rating').eq('id', parsed.data.teeBoxId).single(),
  ]);
  const idx = profile?.current_handicap_index ?? null;
  const courseHcp = (idx != null && teeBox)
    ? Math.round(idx * (teeBox.slope_rating / 113)) : null;

  // 3. Create the round already in progress — no RSVP stage for solo.
  const today = new Date().toISOString().slice(0, 10);        // server-side Date is fine
  const { data: round, error } = await supabase.from('rounds').insert({
    group_id: groupId,
    course_id: parsed.data.courseId,
    tee_box_id: parsed.data.teeBoxId,
    round_date: today,
    round_type: 'solo',
    status: 'in_progress',
    scoring_mode: 'shared',
    created_by: user.id,
  }).select('id').single();
  if (error || !round) return { error: 'Could not start round' };

  // 4. Add the sole player (the user).
  await supabase.from('round_players').insert({
    round_id: round.id,
    user_id: user.id,
    tee_box_id: parsed.data.teeBoxId,
    handicap_index_at_round: idx,
    course_handicap: courseHcp,
    playing_handicap: courseHcp,
    status: 'playing',
  });

  return { success: true, roundId: round.id };
}
```

### `getRecentCourses` — new, in `courses.ts`

Returns the courses the user has recently played (solo or group), most-recent
first, for the Step-1 quick list.

```ts
export async function getRecentCourses(limit = 6) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  // rounds the user created OR played in, newest first, distinct course.
  const { data } = await supabase
    .from('round_players')
    .select('rounds!inner(course_id, round_date, courses(id, name, city, state))')
    .eq('user_id', user.id)
    .order('round_date', { referencedTable: 'rounds', ascending: false })
    .limit(40);
  // de-dup by course_id in JS, cap to `limit`.
  ...
}
```

### `setDefaultTeeTier` — reuse if it exists (settings), else add to `profile` actions

`update profiles set default_tee_tier = $tier where id = auth.uid()`. Called when
the user ticks "Set as my default" in Step 2.

No new game/score actions — scoring uses the existing `upsertScore`.

---

## 5. Frontend

**New route:** `apps/web/src/app/(dashboard)/tee-it-up/`
- `page.tsx` (server) — loads `getRecentCourses()` + the user's `default_tee_tier`.
- `tee-it-up-view.tsx` (client) — the 2-step picker:
  - **Step 1 — Course:** grid of recent-course tiles; a "Find another course"
    affordance that reveals the existing **`CourseSearchPanel`** (search → import).
  - **Step 2 — Tees:** tee-box list for the chosen course, preferred tier
    pre-selected using the same closest-tier match as `acceptRoundInvite`; an
    optional "Set as my default tees" checkbox.
  - **Start Round** → `createSoloRound({courseId, teeBoxId})` →
    `router.push('/rounds/${roundId}/play?tab=enter')`.

**Reused as-is:** `CourseSearchPanel`, `importCourse`, the entire
`/rounds/[roundId]/play` experience (`PlayView`, `ScoreEntryView`, `LeaderboardView`,
`useRealtimeScores`, `upsertScore`).

**Navigation entry points** (all gated on the flag, §7):
- Home: a primary **"Tee It Up Now"** hero button.
- Desktop sidebar → **Play** section, above "Rounds".
- Mobile bottom bar: surface as the prominent center action.

**Play tab default:** confirm `/rounds/[id]/play` honors `?tab=enter` (the shell
already defaults to `enter`; pass the param for explicitness).

---

## 6. Validation  (`packages/core/src/validation/index.ts`)

```ts
export const createSoloRoundSchema = z.object({
  courseId: z.string().uuid(),
  teeBoxId: z.string().uuid(),
});
export type CreateSoloRoundInput = z.infer<typeof createSoloRoundSchema>;
```

---

## 7. Feature flag  (`apps/web/src/lib/feature-flags.ts`)

```ts
export const featureFlags = {
  playExperience: process.env.NEXT_PUBLIC_FEATURE_PLAY_EXPERIENCE === 'true',
  teeItUp:        process.env.NEXT_PUBLIC_FEATURE_TEE_IT_UP === 'true',
} as const;
```

The `/tee-it-up` route and all its entry points render only when
`teeItUp && playExperience` (Type A lands in the Play screen). Add
`NEXT_PUBLIC_FEATURE_TEE_IT_UP=true` to `.env.local.example` with a comment.

---

## 8. Security / RLS notes

- `get_or_create_personal_group()` is `SECURITY DEFINER` and derives the user
  from `auth.uid()` only — it can never create a group for someone else.
- Round INSERT passes the existing "Group members can create rounds" policy
  because the caller is an admin member of their personal group.
- Score writes pass "Round players can upsert scores in shared mode" — the solo
  user is the round's only `round_player`.
- The partial unique index prevents duplicate personal groups under races.

---

## 9. Explicitly out of scope for Phase 1

- Persistent player **roster** (Phase 2 / Type B).
- **GAMEID / join-code** shared leaderboards (Phase 2).
- **Games** on a solo round (Type B).
- **GHIN** import (blocked; see `docs/course-data-providers.md`).
- Renaming/among the "Tee It Up Now" label — placeholder per the UX draft.

---

## 10. Verification checklist

1. `npx supabase db reset` — migration applies clean; new signup gets exactly one
   personal group + admin membership; backfill covers pre-existing users once.
2. New user → Home → **Tee It Up Now** → pick course → Start → lands on
   `/rounds/[id]/play?tab=enter`; enter strokes + shot stats → they persist and
   appear on the Leaderboard tab.
2a. **Confirm scorecard** → the solo round now appears in `/profile/stats`, and a
   subsequent group round's stats aggregate *together* with it (one unified stat
   line, no group split). **Unlock** → it drops from stats; re-confirm → returns.
3. Preferred-tee default pre-selects; "Set as my default" updates the profile and
   sticks on the next solo round.
4. Recent-courses list shows previously played courses, newest first, de-duped.
5. A brand-new user with no history sees the search/import path (empty recents).
6. Flag off → route 404s and no entry points render.
7. `npm run type-check` clean.

---

## 11. Task breakdown (build order)

1. Migration `00023_solo_play.sql` ✅ (written) → `supabase db reset` locally.
2. Regenerate `database.types.ts` (adds `is_personal`, `round_type`, RPC).
3. `createSoloRoundSchema` in core validation.
4. `createSoloRound` + `getRecentCourses` (+ `setDefaultTeeTier` if missing).
5. `teeItUp` feature flag + `.env.local.example`.
6. `/tee-it-up` route + `tee-it-up-view.tsx` (reuse `CourseSearchPanel`).
7. **"Confirm round"** + **"Reopen / Unlock to edit"** affordances in the solo Play
   flow → `finalize_round` / `unfinalize_round` (§3a, migration `00024`). Required
   for stats — do not defer.
8. Nav/Home entry points (flag-gated).
9. Verify (§10, incl. cross-round stats unification) → `type-check`.
```
