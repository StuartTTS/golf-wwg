-- Security fixes migration
-- Addresses: rate_limits table, handicap_records policy, profiles visibility,
-- missing DELETE policies, game_teams policy restrictions

-- ============================================================
-- 1. RATE LIMITS TABLE (was referenced but never created)
-- ============================================================
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_key_ts ON rate_limits(key, timestamp);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate_limits (server actions use service role implicitly)
-- No policies = deny all for anon/authenticated roles, service role bypasses RLS
CREATE POLICY "Service role only"
  ON rate_limits FOR ALL
  USING (false)
  WITH CHECK (false);

-- Cleanup function for expired rate limit entries
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE timestamp < NOW() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 2. FIX HANDICAP RECORDS INSERT POLICY
--    Was: any authenticated user could insert (cheating risk)
--    Now: deny all via RLS, only service role can insert
-- ============================================================
DROP POLICY IF EXISTS "System can insert handicap records" ON handicap_records;

CREATE POLICY "Only service role can insert handicap records"
  ON handicap_records FOR INSERT
  WITH CHECK (false);

-- ============================================================
-- 3. RESTRICT PROFILES SELECT POLICY
--    Was: USING (true) - all profiles visible to all users
--    Now: own profile + profiles of users in shared groups
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;

CREATE POLICY "Users can view own profile and group members"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
    )
  );

-- ============================================================
-- 4. ADD MISSING DELETE POLICIES
-- ============================================================

-- Courses: creator can delete
CREATE POLICY "Creator can delete courses"
  ON courses FOR DELETE
  USING (auth.uid() = created_by);

-- Tee boxes: course creator can delete
CREATE POLICY "Course creator can delete tee boxes"
  ON tee_boxes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = tee_boxes.course_id AND courses.created_by = auth.uid()
    )
  );

-- Rounds: round creator or group admin can delete
CREATE POLICY "Round creator or admin can delete rounds"
  ON rounds FOR DELETE
  USING (
    rounds.created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = rounds.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'admin'
    )
  );

-- ============================================================
-- 5. FIX GAME TEAMS POLICIES
--    INSERT was too permissive (any group member)
--    Now: restricted to round creator or group admin
--    Also add missing UPDATE policy
-- ============================================================
DROP POLICY IF EXISTS "Game creators can manage teams" ON game_teams;

CREATE POLICY "Round creator or admin can insert teams"
  ON game_teams FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      JOIN rounds ON rounds.id = games.round_id
      WHERE games.id = game_teams.game_id
        AND (
          rounds.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = rounds.group_id
              AND group_members.user_id = auth.uid()
              AND group_members.role = 'admin'
          )
        )
    )
  );

-- Add missing UPDATE policy for game_teams
CREATE POLICY "Round creator or admin can update teams"
  ON game_teams FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM games
      JOIN rounds ON rounds.id = games.round_id
      WHERE games.id = game_teams.game_id
        AND (
          rounds.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = rounds.group_id
              AND group_members.user_id = auth.uid()
              AND group_members.role = 'admin'
          )
        )
    )
  );

-- Also fix game_teams DELETE to be consistent
DROP POLICY IF EXISTS "Game creators can delete teams" ON game_teams;

CREATE POLICY "Round creator or admin can delete teams"
  ON game_teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM games
      JOIN rounds ON rounds.id = games.round_id
      WHERE games.id = game_teams.game_id
        AND (
          rounds.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = rounds.group_id
              AND group_members.user_id = auth.uid()
              AND group_members.role = 'admin'
          )
        )
    )
  );
