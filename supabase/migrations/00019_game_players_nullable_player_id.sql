-- Allow guest players to participate in games.
-- player_id was NOT NULL with FK to profiles, but guests don't have profiles.
-- Use round_player_id (added in 00015) as the primary reference instead.
ALTER TABLE game_players ALTER COLUMN player_id DROP NOT NULL;
