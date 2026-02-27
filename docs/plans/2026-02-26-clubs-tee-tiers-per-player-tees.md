# Clubs, Tee Tiers, and Per-Player Tees — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow different players to play from different tees in the same round, with auto-assignment based on profile preferences and admin overrides.

**Architecture:** Add `clubs` table to group courses at a venue. Add `tier` (integer) to `tee_boxes` for cross-course transferability. Change profile preference from color string to tier number. Merge the wizard's Tee Box and Players steps into a single "Players & Tees" step. Fix scorecard and leaderboard to use per-player par values.

**Tech Stack:** Supabase (PostgreSQL migration), Next.js 15 (React 19), TypeScript, Tailwind CSS

---

## Task 1: Database Migration — clubs, tiers, schema changes

**Files:**
- Create: `supabase/migrations/00009_clubs_and_tee_tiers.sql`

**Step 1: Write the migration**

```sql
-- 1. Create clubs table
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for clubs
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clubs"
  ON clubs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create clubs"
  ON clubs FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update club"
  ON clubs FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- 2. Add club_id to courses
ALTER TABLE courses ADD COLUMN club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- 3. Add tier to tee_boxes
ALTER TABLE tee_boxes ADD COLUMN tier INTEGER;

-- 4. Add home_club_id to groups
ALTER TABLE groups ADD COLUMN home_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- 5. Replace default_tee_preference with default_tee_tier on profiles
ALTER TABLE profiles ADD COLUMN default_tee_tier INTEGER;

-- Migrate existing color preferences to tiers (Trophy Club mapping)
UPDATE profiles SET default_tee_tier = CASE default_tee_preference
  WHEN 'silver' THEN 1
  WHEN 'gold' THEN 2
  WHEN 'white' THEN 3
  WHEN 'red' THEN 3    -- approximate mapping
  WHEN 'green' THEN 3  -- approximate mapping
  WHEN 'copper' THEN 4
  WHEN 'blue' THEN 5
  WHEN 'black' THEN 5  -- approximate mapping
  ELSE NULL
END
WHERE default_tee_preference IS NOT NULL AND default_tee_preference != '';

ALTER TABLE profiles DROP COLUMN default_tee_preference;
```

**Step 2: Push migration**

Run: `npx supabase db push`

**Step 3: Commit**

```
feat: add clubs table, tee tiers, and per-player tee support schema
```

---

## Task 2: Seed Trophy Club data

**Files:**
- Create: `supabase/migrations/00010_seed_trophy_club.sql`

**Step 1: Write the seed migration**

This needs to be written after checking what courses already exist. The migration should:
- Create "Trophy Club Country Club" in `clubs`
- Update existing Trophy Club courses to set `club_id`
- Set `tier` on all existing tee boxes by matching color/name

```sql
-- Create the club
INSERT INTO clubs (id, name, location)
VALUES (gen_random_uuid(), 'Trophy Club Country Club', 'Trophy Club, TX');

-- Link courses (use subquery to find club id)
UPDATE courses
SET club_id = (SELECT id FROM clubs WHERE name = 'Trophy Club Country Club')
WHERE name ILIKE '%trophy%';

-- Set tiers on tee boxes for Trophy Club courses
-- tier 1 = Silver (front), 2 = Gold, 3 = White, 4 = Copper, 5 = Blue (tips)
UPDATE tee_boxes SET tier = 1 WHERE LOWER(name) LIKE '%silver%' AND course_id IN (SELECT id FROM courses WHERE club_id IS NOT NULL);
UPDATE tee_boxes SET tier = 2 WHERE LOWER(name) LIKE '%gold%' AND course_id IN (SELECT id FROM courses WHERE club_id IS NOT NULL);
UPDATE tee_boxes SET tier = 3 WHERE LOWER(name) LIKE '%white%' AND course_id IN (SELECT id FROM courses WHERE club_id IS NOT NULL);
UPDATE tee_boxes SET tier = 4 WHERE LOWER(name) LIKE '%copper%' AND course_id IN (SELECT id FROM courses WHERE club_id IS NOT NULL);
UPDATE tee_boxes SET tier = 5 WHERE LOWER(name) LIKE '%blue%' AND course_id IN (SELECT id FROM courses WHERE club_id IS NOT NULL);
```

**Step 2: Push migration**

Run: `npx supabase db push`

**Step 3: Commit**

```
feat: seed Trophy Club CC with tee tiers
```

---

## Task 3: Update validation schemas

**Files:**
- Modify: `packages/core/src/validation/index.ts`

**Step 1: Update schemas**

In `updateProfileSchema` (line 39-43): change `defaultTeePreference: z.string()` to `defaultTeeTier: z.number().int().min(1).max(10).nullable()`.

In `teeBoxSchema` (line 54-60): add `tier: z.number().int().min(1).max(10).optional()`.

In `createRoundSchema` (line 82-93): `teeBoxId` stays (used as the round's default tee) but is now optional since each player gets their own.

In `createGroupSchema` (line 70-74): add `homeClubId: z.string().uuid().optional()`.

**Step 2: Build and type-check**

Run: `npm run type-check`

**Step 3: Commit**

```
feat: update validation schemas for tee tiers and clubs
```

---

## Task 4: Update Settings page — tier selector

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`

**Step 1: Update the settings form**

Change `defaultTeePreference: string` in the `UserSettings` interface (line 25) to `defaultTeeTier: number | null`.

Update `fetchSettings` (line 60-64): read `default_tee_tier` instead of `default_tee_preference`.

Update `handleSaveProfile` (line 91-98): write `default_tee_tier` instead of `default_tee_preference`.

Replace the color dropdown (lines 218-245) with a tier selector:
- Options: "No preference", "1 (Front)", "2", "3", "4", "5 (Tips)"
- Use a `SimpleSelect` with numeric values
- Helper text: "Your preferred tee position. 1 = front tees, higher = further back."

**Step 2: Type-check**

Run: `npm run type-check`

**Step 3: Commit**

```
feat: replace tee color preference with numeric tier selector
```

---

## Task 5: Update Round Creation Wizard — merged Players & Tees step

**Files:**
- Modify: `apps/web/src/app/(dashboard)/groups/[groupId]/rounds/new/create-round-wizard.tsx`
- Modify: `apps/web/src/app/(dashboard)/groups/[groupId]/rounds/new/page.tsx` (pass tee tier data in members)

**Step 1: Update member interface and data**

In the page.tsx server component, update the members query to include `default_tee_tier`:
```typescript
.select('user_id, profiles(id, display_name, current_handicap_index, default_tee_tier)')
```

Update the `GroupMember` interface in create-round-wizard.tsx to include `default_tee_tier: number | null` on the profile.

**Step 2: Merge Tee Box and Players into one step**

Change `STEPS` from `['course', 'tee', 'datetime', 'players']` to `['course', 'datetime', 'players']`.

On the `players` step, add:
1. A "Default Tees" dropdown at the top (selects from tee boxes for the selected course). This replaces the old dedicated tee step.
2. For each player row, add a per-player tee dropdown (small inline select).
3. Auto-assign logic: when a player is toggled on, if they have a `default_tee_tier`, find the tee box with matching tier. Otherwise use the default tee.
4. A "Use Preferred Tees" button that resets all players to auto-assigned.

**Step 3: Update form submission**

Instead of sending a single `teeBoxId`, send player-tee assignments. Add a new form field pattern:
```typescript
// For each player, append their tee box assignment
playerTeeAssignments.forEach(({ userId, teeBoxId }) => {
  formData.append('playerTeeBoxIds', `${userId}:${teeBoxId}`);
});
// Still send a default teeBoxId for the round record
formData.set('teeBoxId', defaultTeeBoxId);
```

**Step 4: Type-check**

Run: `npm run type-check`

**Step 5: Commit**

```
feat: merge tee and player steps in round wizard with per-player tee assignment
```

---

## Task 6: Update `createRound` server action — per-player tee box IDs

**Files:**
- Modify: `apps/web/src/lib/actions/rounds.ts`

**Step 1: Parse player-tee assignments**

In `createRound()`, read the new `playerTeeBoxIds` form data:
```typescript
const playerTeeEntries = formData.getAll('playerTeeBoxIds') as string[];
const playerTeeMap = new Map<string, string>();
for (const entry of playerTeeEntries) {
  const [userId, teeBoxId] = entry.split(':');
  playerTeeMap.set(userId, teeBoxId);
}
```

**Step 2: Use per-player tee boxes when inserting round_players**

Replace the current "add creator as player" insert (line 49-54) and the invitation loop to use each player's assigned tee box from the map, falling back to the round's default `teeBoxId`.

Recalculate course handicap per player using their specific tee box's slope/rating.

**Step 3: Type-check**

Run: `npm run type-check`

**Step 4: Commit**

```
feat: create round with per-player tee box assignments
```

---

## Task 7: Update RSVP flow — use player's preferred tier

**Files:**
- Modify: `apps/web/src/lib/actions/rounds.ts` (acceptRoundInvite, ~line 346)

**Step 1: Look up player's preferred tier and match to course tee box**

In `acceptRoundInvite()`, after fetching the player's profile (line 379-383), also read `default_tee_tier`. Then fetch the course's tee boxes via the round's course_id. Match the player's tier to the best tee box:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('current_handicap_index, default_tee_tier')
  .eq('id', user.id)
  .single();

// Get course tee boxes to match tier
const { data: courseTeeBoxes } = await supabase
  .from('tee_boxes')
  .select('id, tier, slope_rating, course_rating')
  .eq('course_id', round.course_id)
  .order('tier', { ascending: true });

let assignedTeeBoxId = round.tee_box_id; // default
let assignedTeeBox = teeBox; // for handicap calc

if (profile?.default_tee_tier && courseTeeBoxes) {
  const match = courseTeeBoxes.find(t => t.tier === profile.default_tee_tier)
    ?? courseTeeBoxes.reduce((prev, curr) =>
      Math.abs((curr.tier ?? 0) - profile.default_tee_tier!) < Math.abs((prev.tier ?? 0) - profile.default_tee_tier!)
        ? curr : prev
    );
  if (match) {
    assignedTeeBoxId = match.id;
    assignedTeeBox = match;
  }
}
```

Use `assignedTeeBoxId` and `assignedTeeBox` for the insert and handicap calculation.

**Step 2: Also need round's course_id**

Update the round fetch (line 370-374) to also select `course_id`:
```typescript
.select('tee_box_id, course_id')
```

**Step 3: Type-check**

Run: `npm run type-check`

**Step 4: Commit**

```
feat: auto-assign tee box from player's preferred tier on RSVP accept
```

---

## Task 8: Fix Scorecard — per-player par values

**Files:**
- Modify: `apps/web/src/app/(dashboard)/rounds/[roundId]/scorecard/page.tsx`

**Step 1: Update data model**

Change `RoundData.holes` from a single `HoleInfo[]` to a map by tee box:
```typescript
interface RoundData {
  // ... existing fields
  players: Player[];
  holesByTeeBox: Record<string, HoleInfo[]>; // keyed by tee_box_id
}
```

**Step 2: Load holes for all unique tee boxes**

Replace the single holes query (lines 560-564):
```typescript
// Get unique tee box IDs from players
const uniqueTeeBoxIds = [...new Set(roundData.round_players.map((rp: any) => rp.tee_box_id))];

// Fetch holes for all tee boxes in one query
const { data: allHolesData } = await supabase
  .from('holes')
  .select('hole_number, par, handicap_index, yardage, tee_box_id')
  .in('tee_box_id', uniqueTeeBoxIds)
  .order('hole_number');

// Group by tee_box_id
const holesByTeeBox: Record<string, HoleInfo[]> = {};
for (const h of allHolesData ?? []) {
  if (!holesByTeeBox[h.tee_box_id]) holesByTeeBox[h.tee_box_id] = [];
  holesByTeeBox[h.tee_box_id].push({
    number: h.hole_number,
    par: h.par,
    strokeIndex: h.handicap_index,
    yardage: h.yardage,
  });
}
```

**Step 3: Update par lookups throughout the component**

Anywhere the component reads `round.holes[index].par`, change to look up the correct par for the current player's tee box:
```typescript
function getPlayerPar(playerId: string, holeNumber: number): number {
  const player = round.players.find(p => p.id === playerId);
  const holes = round.holesByTeeBox[player?.teeBoxId ?? ''] ?? Object.values(round.holesByTeeBox)[0] ?? [];
  return holes.find(h => h.number === holeNumber)?.par ?? 4;
}
```

The ScoreCell component already receives `par` as a prop — update the callers to pass the player-specific par.

For the "par row" display, use the logged-in player's tee box.

**Step 4: Type-check**

Run: `npm run type-check`

**Step 5: Commit**

```
feat: scorecard uses per-player par values from their assigned tee box
```

---

## Task 9: Fix Leaderboard — per-player par calculation

**Files:**
- Modify: `apps/web/src/app/(dashboard)/rounds/[roundId]/page.tsx`

**Step 1: Load holes for all player tee boxes**

Replace the single tee box hole query (lines 84-91):
```typescript
// Get unique tee box IDs from players
const uniqueTeeBoxIds = [...new Set(players?.map(p => p.tee_box_id).filter(Boolean) ?? [])];

const { data: allHoles } = uniqueTeeBoxIds.length > 0
  ? await supabase
      .from('holes')
      .select('hole_number, par, tee_box_id')
      .in('tee_box_id', uniqueTeeBoxIds)
  : { data: null };

// Build per-tee-box par maps
const parMaps = new Map<string, Map<number, number>>();
allHoles?.forEach((h) => {
  if (!parMaps.has(h.tee_box_id)) parMaps.set(h.tee_box_id, new Map());
  parMaps.get(h.tee_box_id)!.set(h.hole_number, h.par);
});
```

**Step 2: Use player-specific par map in leaderboard calculation**

Replace the score aggregation (lines 96-105) to look up each player's tee box:
```typescript
// Build a player -> tee_box_id map
const playerTeeMap = new Map<string, string>();
players?.forEach(p => playerTeeMap.set(p.user_id, p.tee_box_id));

for (const score of scores) {
  const existing = playerScores.get(score.player_id) ?? { strokes: 0, holesPlayed: 0, totalPar: 0 };
  existing.strokes += score.strokes!;
  existing.holesPlayed += 1;

  const playerTeeBoxId = playerTeeMap.get(score.player_id) ?? '';
  const playerParMap = parMaps.get(playerTeeBoxId);
  existing.totalPar += playerParMap?.get(score.hole_number) ?? 0;

  playerScores.set(score.player_id, existing);
}
```

**Step 3: Update Round Details card to show per-player tees**

In the Players card section, show each player's tee box name/color instead of showing a single tee for the round. Fetch tee box details along with players:
```typescript
.select(`
  user_id, tee_box_id, status, handicap_index_at_round, course_handicap,
  profile:profiles (id, display_name, current_handicap_index),
  tee_box:tee_boxes (id, name, color)
`)
```

**Step 4: Type-check**

Run: `npm run type-check`

**Step 5: Commit**

```
feat: leaderboard uses per-player par values and shows tee assignments
```

---

## Task 10: Update Group Settings — home club selector

**Files:**
- Modify: `apps/web/src/app/(dashboard)/groups/[groupId]/settings/page.tsx`
- Modify: `apps/web/src/lib/actions/groups.ts`

**Step 1: Add home club dropdown to group settings**

Fetch clubs list and add a "Home Club" select above the default course select. When a club is selected, filter the default course dropdown to only show courses at that club.

**Step 2: Update `updateGroup` action**

Add `homeClubId` to the update payload.

**Step 3: Type-check**

Run: `npm run type-check`

**Step 4: Commit**

```
feat: add home club selector to group settings
```

---

## Task 11: Final verification

**Step 1: Full type-check**

Run: `npm run type-check`

**Step 2: Build**

Run: `npm run build`

**Step 3: Manual test checklist**

- [ ] Settings page shows tier selector (1-5)
- [ ] Round wizard shows merged Players & Tees step
- [ ] Per-player tee dropdowns auto-assign based on profile tier
- [ ] Admin can override individual player tees
- [ ] Scorecard shows correct par for each player's tee
- [ ] Leaderboard calculates to-par correctly per player
- [ ] RSVP auto-assigns correct tee based on player preference
- [ ] Group settings shows home club dropdown

**Step 4: Deploy**

Run: `npm run deploy` and `npx supabase db push`

**Step 5: Commit any fixes**

---

## Files Summary

| File | Change |
|------|--------|
| `supabase/migrations/00009_clubs_and_tee_tiers.sql` | **NEW** — clubs table, tee tier column, schema changes |
| `supabase/migrations/00010_seed_trophy_club.sql` | **NEW** — seed Trophy Club CC data |
| `packages/core/src/validation/index.ts` | Update schemas for tier, club |
| `apps/web/src/app/(dashboard)/settings/page.tsx` | Tier selector replaces color dropdown |
| `apps/web/src/app/(dashboard)/groups/[groupId]/rounds/new/create-round-wizard.tsx` | Merged Players & Tees step |
| `apps/web/src/app/(dashboard)/groups/[groupId]/rounds/new/page.tsx` | Pass tier data in members |
| `apps/web/src/lib/actions/rounds.ts` | Per-player tee in createRound + RSVP tier matching |
| `apps/web/src/app/(dashboard)/rounds/[roundId]/scorecard/page.tsx` | Per-player par values |
| `apps/web/src/app/(dashboard)/rounds/[roundId]/page.tsx` | Leaderboard per-player par + tee display |
| `apps/web/src/app/(dashboard)/groups/[groupId]/settings/page.tsx` | Home club selector |
| `apps/web/src/lib/actions/groups.ts` | Accept homeClubId in updateGroup |
