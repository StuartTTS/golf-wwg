-- ============================================================
-- Migration 00009: Clubs table, tee box tiers, profile tee tier
-- ============================================================
-- Introduces the concept of "clubs" that own courses, adds a
-- numeric tier to tee boxes (1 = shortest/forward, higher = longer),
-- and replaces the old text-based default_tee_preference on
-- profiles with a numeric default_tee_tier.
-- ============================================================

-- ============================================================
-- 1. CREATE CLUBS TABLE
-- ============================================================
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all clubs
CREATE POLICY "Authenticated users can view clubs"
  ON clubs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can create clubs (must be the creator)
CREATE POLICY "Authenticated users can create clubs"
  ON clubs FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Creator can update their club
CREATE POLICY "Creator can update clubs"
  ON clubs FOR UPDATE
  USING (auth.uid() = created_by);

-- ============================================================
-- 2. ADD club_id TO COURSES
-- ============================================================
ALTER TABLE courses
  ADD COLUMN club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- ============================================================
-- 3. ADD tier TO TEE_BOXES
-- ============================================================
-- tier: 1 = front/shortest tees, higher numbers = further back
ALTER TABLE tee_boxes
  ADD COLUMN tier INTEGER;

-- ============================================================
-- 4. ADD home_club_id TO GROUPS
-- ============================================================
ALTER TABLE groups
  ADD COLUMN home_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- ============================================================
-- 5. ADD default_tee_tier TO PROFILES
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN default_tee_tier INTEGER;

-- ============================================================
-- 6. MIGRATE default_tee_preference -> default_tee_tier
-- ============================================================
-- Map color names to numeric tier values:
--   silver -> 1  (shortest/forward)
--   gold   -> 2
--   white  -> 3, red -> 3, green -> 3
--   copper -> 4
--   blue   -> 5, black -> 5  (longest/back)
UPDATE profiles
SET default_tee_tier = CASE LOWER(TRIM(default_tee_preference))
  WHEN 'silver' THEN 1
  WHEN 'gold'   THEN 2
  WHEN 'white'  THEN 3
  WHEN 'red'    THEN 3
  WHEN 'green'  THEN 3
  WHEN 'copper' THEN 4
  WHEN 'blue'   THEN 5
  WHEN 'black'  THEN 5
  ELSE NULL
END
WHERE default_tee_preference IS NOT NULL
  AND TRIM(default_tee_preference) <> '';

-- ============================================================
-- 7. DROP OLD default_tee_preference COLUMN
-- ============================================================
ALTER TABLE profiles
  DROP COLUMN default_tee_preference;
