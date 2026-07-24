-- ============================================================
-- PERSISTENT PLAYER ROSTER  (Phase 2 / Type B "Game Time")
-- ============================================================
-- An individual-owned, reusable list of people a user plays with. Replaces the
-- per-round-only guest model with a persistent identity that round participation
-- links back to, so guests gain a cross-round identity and stats can follow a
-- person once they're on the app. See docs/roster-design.md.
--
-- Key rules:
--   * Individual-owned ("my roster") — owner_id. Not shared (would leak contacts).
--   * Entries are LINKED to a real account (linked_user_id) or UNLINKED
--     (name/handicap/email-only contact).
--   * email is the durable CLAIM/MATCH key; phone is optional contact (share/SMS).
--   * handicap_index here is the *player-claimed* value, NOT the game handicap
--     (round_players.playing_handicap, Commish-governed).
-- ============================================================

-- 1. ROSTER TABLE --------------------------------------------------------
CREATE TABLE roster_players (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  linked_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  display_name   TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  handicap_index NUMERIC(4,1),
  ghin_id        TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_roster_display_name CHECK (char_length(trim(display_name)) > 0)
);

-- One entry per registered friend per owner.
CREATE UNIQUE INDEX idx_roster_owner_linked
  ON roster_players(owner_id, linked_user_id) WHERE linked_user_id IS NOT NULL;

-- Dedup unlinked contacts by email (case-insensitive) per owner.
CREATE UNIQUE INDEX idx_roster_owner_email
  ON roster_players(owner_id, lower(email))
  WHERE email IS NOT NULL AND linked_user_id IS NULL;

CREATE INDEX idx_roster_owner ON roster_players(owner_id);
-- Reverse lookup: find roster entries pointing at a given account (relink/claim).
CREATE INDEX idx_roster_linked_user
  ON roster_players(linked_user_id) WHERE linked_user_id IS NOT NULL;

-- Keep updated_at fresh (reuses the 00001 helper).
CREATE TRIGGER roster_players_updated_at
  BEFORE UPDATE ON roster_players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. RLS — owner-only (a roster is personal) ----------------------------
ALTER TABLE roster_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own roster"
  ON roster_players FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owner can insert own roster"
  ON roster_players FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update own roster"
  ON roster_players FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can delete own roster"
  ON roster_players FOR DELETE
  USING (owner_id = auth.uid());

-- 3. LINK ROUND PARTICIPATION TO THE PERSISTENT IDENTITY ----------------
-- Every round_player (registered OR guest) may point back to a roster entry.
-- ON DELETE SET NULL: deleting a roster entry keeps historical participation,
-- it just drops the back-link. No new RLS needed — round_players already has it.
ALTER TABLE round_players
  ADD COLUMN roster_player_id UUID REFERENCES roster_players(id) ON DELETE SET NULL;

CREATE INDEX idx_round_players_roster
  ON round_players(roster_player_id) WHERE roster_player_id IS NOT NULL;
