-- ============================================================
-- GUEST PLAYER SUPPORT
-- Allow non-registered users to participate in rounds as guests.
-- ============================================================

-- Make user_id nullable and add guest columns to round_players
ALTER TABLE round_players ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE round_players ADD COLUMN guest_name TEXT;
ALTER TABLE round_players ADD COLUMN guest_handicap_index NUMERIC(4,1);

-- Ensure either user_id or guest_name is set (never both null)
ALTER TABLE round_players ADD CONSTRAINT chk_player_identity
  CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL);

-- Drop the old unique constraint on (round_id, user_id) and create a partial
-- unique index that only applies when user_id IS NOT NULL.
-- This allows multiple guests per round while still preventing duplicate
-- registered users in the same round.
ALTER TABLE round_players DROP CONSTRAINT IF EXISTS round_players_round_id_user_id_key;
CREATE UNIQUE INDEX idx_round_players_user_unique
  ON round_players(round_id, user_id) WHERE user_id IS NOT NULL;

-- Add round_player_id to scores for guest support.
-- Existing scores keep using player_id; new guest scores will use round_player_id.
ALTER TABLE scores ADD COLUMN round_player_id UUID REFERENCES round_players(id) ON DELETE CASCADE;

-- Add round_player_id to game_players for guest support.
ALTER TABLE game_players ADD COLUMN round_player_id UUID REFERENCES round_players(id) ON DELETE CASCADE;

-- Backfill round_player_id on existing scores so every row has it populated.
UPDATE scores SET round_player_id = rp.id
FROM round_players rp
WHERE scores.round_id = rp.round_id AND scores.player_id = rp.user_id;

-- Backfill round_player_id on existing game_players.
UPDATE game_players SET round_player_id = rp.id
FROM round_players rp
JOIN games g ON g.round_id = rp.round_id
WHERE game_players.game_id = g.id AND game_players.player_id = rp.user_id;

-- RLS: Group members can add guest players to rounds they belong to.
-- The existing "Group members can join rounds" INSERT policy requires
-- group_members.user_id = auth.uid() which works for self-joining.
-- Guests have user_id = NULL so we need an explicit policy for them.
CREATE POLICY "Group members can add guest players"
  ON round_players FOR INSERT
  WITH CHECK (
    user_id IS NULL
    AND guest_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM rounds
      JOIN group_members ON group_members.group_id = rounds.group_id
      WHERE rounds.id = round_players.round_id AND group_members.user_id = auth.uid()
    )
  );
