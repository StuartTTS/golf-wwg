-- ============================================================
-- Migration 00010: Seed Trophy Club Country Club data
-- ============================================================
-- Creates the Trophy Club CC record and links existing courses
-- and tee boxes that match the Trophy Club naming pattern.
-- ============================================================

-- ============================================================
-- 1. INSERT TROPHY CLUB (idempotent: skip if already exists)
-- ============================================================
INSERT INTO clubs (name, location)
SELECT 'Trophy Club Country Club', 'Trophy Club, TX'
WHERE NOT EXISTS (
  SELECT 1 FROM clubs WHERE name = 'Trophy Club Country Club'
);

-- ============================================================
-- 2. LINK EXISTING TROPHY CLUB COURSES TO THE CLUB
-- ============================================================
UPDATE courses
SET club_id = (SELECT id FROM clubs WHERE name = 'Trophy Club Country Club')
WHERE LOWER(name) LIKE '%trophy%'
  AND club_id IS NULL;

-- ============================================================
-- 3. SET TEE BOX TIERS FOR TROPHY CLUB COURSES
-- ============================================================
-- Map tee name (case-insensitive) to tier:
--   silver -> 1 (shortest/forward)
--   gold   -> 2
--   white  -> 3
--   copper -> 4
--   blue   -> 5 (longest/back)
UPDATE tee_boxes
SET tier = CASE LOWER(TRIM(tee_boxes.name))
  WHEN 'silver' THEN 1
  WHEN 'gold'   THEN 2
  WHEN 'white'  THEN 3
  WHEN 'copper' THEN 4
  WHEN 'blue'   THEN 5
  ELSE NULL
END
WHERE tee_boxes.course_id IN (
  SELECT c.id FROM courses c
  JOIN clubs cl ON cl.id = c.club_id
  WHERE cl.name = 'Trophy Club Country Club'
)
AND tee_boxes.tier IS NULL;
