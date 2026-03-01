-- ============================================================
-- TEE TIME GROUPS
-- Allows admins to split round players into separate tee-time
-- foursomes. Players in the same group can score for each other.
-- ============================================================

CREATE TABLE tee_time_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Group 1',
  tee_time TIME,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tee_time_groups_round ON tee_time_groups(round_id);

ALTER TABLE tee_time_groups ENABLE ROW LEVEL SECURITY;

-- Any authenticated group member can view tee time groups for their rounds
CREATE POLICY "Group members can view tee time groups"
  ON tee_time_groups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rounds r
      JOIN group_members gm ON gm.group_id = r.group_id
      WHERE r.id = tee_time_groups.round_id
        AND gm.user_id = auth.uid()
    )
  );

-- Group admins can insert/update/delete tee time groups
CREATE POLICY "Group admins can manage tee time groups"
  ON tee_time_groups FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rounds r
      JOIN group_members gm ON gm.group_id = r.group_id
      WHERE r.id = tee_time_groups.round_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rounds r
      JOIN group_members gm ON gm.group_id = r.group_id
      WHERE r.id = tee_time_groups.round_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
    )
  );

-- Add tee_time_group_id FK to round_players
ALTER TABLE round_players
  ADD COLUMN tee_time_group_id UUID REFERENCES tee_time_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_round_players_tee_time_group ON round_players(tee_time_group_id);

-- ============================================================
-- UPDATE SCORE POLICIES
-- Replace the existing INSERT and UPDATE policies so that
-- players in the same tee-time group can also score for each
-- other (in addition to shared/scorekeeper modes).
-- ============================================================

DROP POLICY IF EXISTS "Round players can upsert scores in shared mode" ON scores;
DROP POLICY IF EXISTS "Score entry permissions for update" ON scores;

-- Unified INSERT policy
CREATE POLICY "Round players can insert scores"
  ON scores FOR INSERT TO authenticated
  WITH CHECK (
    -- Shared mode: any round player
    EXISTS (
      SELECT 1 FROM rounds r
      JOIN round_players rp ON rp.round_id = r.id
      WHERE r.id = scores.round_id
        AND r.scoring_mode = 'shared'
        AND rp.user_id = auth.uid()
    )
    OR
    -- Scorekeeper mode
    EXISTS (
      SELECT 1 FROM rounds r
      WHERE r.id = scores.round_id
        AND r.scoring_mode = 'scorekeeper'
        AND r.scorekeeper_id = auth.uid()
    )
    OR
    -- Same tee-time group
    EXISTS (
      SELECT 1 FROM round_players scorer
      JOIN round_players target ON target.round_id = scorer.round_id
      WHERE scorer.round_id = scores.round_id
        AND scorer.user_id = auth.uid()
        AND scorer.tee_time_group_id IS NOT NULL
        AND scorer.tee_time_group_id = target.tee_time_group_id
        AND (target.user_id = scores.player_id OR target.id::text = scores.player_id::text)
    )
    OR
    -- Players can always score for themselves
    scores.player_id = auth.uid()
  );

-- Unified UPDATE policy
CREATE POLICY "Round players can update scores"
  ON scores FOR UPDATE TO authenticated
  USING (
    -- Shared mode: any round player
    EXISTS (
      SELECT 1 FROM rounds r
      JOIN round_players rp ON rp.round_id = r.id
      WHERE r.id = scores.round_id
        AND r.scoring_mode = 'shared'
        AND rp.user_id = auth.uid()
    )
    OR
    -- Scorekeeper mode
    EXISTS (
      SELECT 1 FROM rounds r
      WHERE r.id = scores.round_id
        AND r.scoring_mode = 'scorekeeper'
        AND r.scorekeeper_id = auth.uid()
    )
    OR
    -- Same tee-time group
    EXISTS (
      SELECT 1 FROM round_players scorer
      JOIN round_players target ON target.round_id = scorer.round_id
      WHERE scorer.round_id = scores.round_id
        AND scorer.user_id = auth.uid()
        AND scorer.tee_time_group_id IS NOT NULL
        AND scorer.tee_time_group_id = target.tee_time_group_id
        AND (target.user_id = scores.player_id OR target.id::text = scores.player_id::text)
    )
    OR
    -- Players can always score for themselves
    scores.player_id = auth.uid()
  );
