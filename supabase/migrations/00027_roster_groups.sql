-- ============================================================
-- ROSTER GROUPS — personal folders over the roster (Phase 2)
-- ============================================================
-- Owner-scoped, named subsets of a user's roster ("Sunday Crew", "Night League",
-- "Ryder Cup 2026"). Private (like phone-contact labels), multi-membership, and
-- can hold unlinked contacts because members are roster entries, not accounts.
-- Used to pre-fill game/cup setup (a Group is an editable default, never a
-- constraint). See docs/groups-as-roster-folders.md.
--
-- NOTE: distinct from the existing shared `groups` table (which hosts rounds /
-- is the RLS boundary). No change to that here.
-- ============================================================

CREATE TABLE roster_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_roster_group_name CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX idx_roster_groups_owner ON roster_groups(owner_id);
-- One folder name per owner (case-insensitive).
CREATE UNIQUE INDEX idx_roster_groups_owner_name ON roster_groups(owner_id, lower(name));

CREATE TRIGGER roster_groups_updated_at
  BEFORE UPDATE ON roster_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE roster_group_members (
  roster_group_id  UUID NOT NULL REFERENCES roster_groups(id) ON DELETE CASCADE,
  roster_player_id UUID NOT NULL REFERENCES roster_players(id) ON DELETE CASCADE,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (roster_group_id, roster_player_id)
);

CREATE INDEX idx_roster_group_members_player ON roster_group_members(roster_player_id);

-- ---- RLS: owner-only -------------------------------------------------------
ALTER TABLE roster_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own roster groups"
  ON roster_groups FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Owner can insert own roster groups"
  ON roster_groups FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can update own roster groups"
  ON roster_groups FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can delete own roster groups"
  ON roster_groups FOR DELETE USING (owner_id = auth.uid());

ALTER TABLE roster_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view roster group members"
  ON roster_group_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM roster_groups g
    WHERE g.id = roster_group_members.roster_group_id AND g.owner_id = auth.uid()
  ));
CREATE POLICY "Owner can add roster group members"
  ON roster_group_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM roster_groups g
    WHERE g.id = roster_group_members.roster_group_id AND g.owner_id = auth.uid()
  ));
CREATE POLICY "Owner can remove roster group members"
  ON roster_group_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM roster_groups g
    WHERE g.id = roster_group_members.roster_group_id AND g.owner_id = auth.uid()
  ));
