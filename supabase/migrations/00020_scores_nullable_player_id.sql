-- Allow guest players to have scores.
-- player_id was NOT NULL with FK to profiles, but guests don't have profiles.
-- Use round_player_id (added in 00015) as the primary reference instead.
ALTER TABLE scores ALTER COLUMN player_id DROP NOT NULL;

-- Add a unique constraint on round_player_id + hole_number for score upserts.
-- Non-partial index so ON CONFLICT works with Supabase's upsert().
-- NULLs are distinct in PostgreSQL unique indexes, so rows with
-- round_player_id=NULL won't conflict (registered players also use
-- the original (round_id, player_id, hole_number) constraint).
CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_round_player_hole
  ON scores(round_id, round_player_id, hole_number);
