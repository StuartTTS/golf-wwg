-- ============================================================
-- SHOT STATS + PER-FLIGHT SCORER
-- Adds PGA-style, hole-level shot detail to `scores` (amateur-tuned:
-- fairway/green miss direction, bunkers, penalties) and a per
-- tee-time-group designated scorer.
--
-- Detailed stats are "scorer-only" by product rule: only the player
-- entering their own card fills these in. Enforced in the UI, not RLS
-- (the new columns inherit the existing scores row policies from 00017).
-- ============================================================

-- ---------- scores: shot detail ----------
ALTER TABLE scores
  ADD COLUMN fairway_miss     TEXT CHECK (fairway_miss IN ('left', 'right')),
  ADD COLUMN green_miss       TEXT CHECK (green_miss IN ('short', 'long', 'left', 'right')),
  ADD COLUMN fairway_bunker   BOOLEAN,
  ADD COLUMN greenside_bunker BOOLEAN,
  ADD COLUMN penalties        INT CHECK (penalties >= 0 AND penalties <= 10);

COMMENT ON COLUMN scores.fairway_miss     IS 'Direction of tee-shot miss when fairway_hit = false (par 4/5). NULL if hit or N/A.';
COMMENT ON COLUMN scores.green_miss        IS 'Direction of approach miss when gir = false. NULL if green hit.';
COMMENT ON COLUMN scores.fairway_bunker    IS 'Ball was in a fairway bunker on this hole.';
COMMENT ON COLUMN scores.greenside_bunker  IS 'Ball was in a greenside bunker on this hole (drives sand-save calc).';
COMMENT ON COLUMN scores.penalties         IS 'Penalty strokes taken on this hole (water, OB, lost ball).';

-- ---------- tee_time_groups: designated scorer ----------
-- NULL = shared self-scoring within the flight. When set, that profile is
-- the flight's designated scorer (enters strokes for everyone in the flight).
ALTER TABLE tee_time_groups
  ADD COLUMN scorer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN tee_time_groups.scorer_id IS 'Designated per-flight scorer. NULL = each player self-scores.';

-- The round creator ("Commish") can manage tee-time groups (e.g. designate a
-- scorer) even if they are not a group admin. Complements the existing
-- "Group admins can manage tee time groups" policy from 00017.
CREATE POLICY "Round creator can manage tee time groups"
  ON tee_time_groups FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rounds r
      WHERE r.id = tee_time_groups.round_id
        AND r.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rounds r
      WHERE r.id = tee_time_groups.round_id
        AND r.created_by = auth.uid()
    )
  );
