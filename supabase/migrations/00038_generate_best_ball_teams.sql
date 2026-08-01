-- ============================================================
-- 2-MAN BEST BALL — RANDOM TEAM GENERATION  (Phase 4)
-- ============================================================
-- The Commish adds a "2-Man Best Ball — Random Teams" game upfront (buy-in +
-- payout split live in games.config). Teams are drawn LATER: once every player
-- has a recorded score on every hole, the Commish taps "Generate teams" and this
-- RPC randomly pairs the seated players into the existing game. Re-draw is
-- allowed until the game is finalized.
-- ============================================================

-- 1. COMPLETENESS GATE ---------------------------------------------------
-- "Recorded" = strokes present OR pickup. Only seated players (tee_box_id set)
-- are required; each plays the holes of their own tee box.
CREATE OR REPLACE FUNCTION round_scores_complete(p_round_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.round_players rp
      WHERE rp.round_id = p_round_id AND rp.tee_box_id IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.round_players rp
      JOIN public.holes h ON h.tee_box_id = rp.tee_box_id
      LEFT JOIN public.scores s
        ON s.round_id = p_round_id
       AND s.round_player_id = rp.id
       AND s.hole_number = h.hole_number
      WHERE rp.round_id = p_round_id
        AND rp.tee_box_id IS NOT NULL
        AND (s.id IS NULL OR (s.strokes IS NULL AND s.pickup = false))
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. HELPER: add a round_player to a game team --------------------------
CREATE OR REPLACE FUNCTION insert_game_player(
  p_game UUID, p_team UUID, p_rp_id UUID
) RETURNS VOID AS $$
  INSERT INTO public.game_players (game_id, team_id, player_id, round_player_id, playing_handicap)
  SELECT p_game, p_team, rp.user_id, rp.id, rp.playing_handicap
  FROM public.round_players rp WHERE rp.id = p_rp_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 3. GENERATE (or re-draw) RANDOM 2-MAN TEAMS --------------------------
-- p_odd_mode: 'leave_out' (default — trailing player sits, doesn't ante) or
-- 'team_of_3' (trailing player folds into the last team). Returns team count.
CREATE OR REPLACE FUNCTION generate_best_ball_teams(
  p_game_id UUID,
  p_odd_mode TEXT
) RETURNS INT AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_round UUID;
  v_status TEXT;
  v_ids   UUID[];
  v_n     INT;
  v_team  UUID;
  v_t     INT := 0;
  i       INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT round_id, status INTO v_round, v_status
  FROM public.games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;

  IF NOT can_finalize_round(v_round, v_user) THEN
    RAISE EXCEPTION 'Only the Commish can generate teams';
  END IF;
  IF v_status = 'finalized' THEN
    RAISE EXCEPTION 'This game is finalized — reopen it to redraw teams';
  END IF;
  IF NOT round_scores_complete(v_round) THEN
    RAISE EXCEPTION 'Every player needs a score on every hole first';
  END IF;

  SELECT array_agg(rp.id ORDER BY random())
    INTO v_ids
  FROM public.round_players rp
  WHERE rp.round_id = v_round AND rp.tee_box_id IS NOT NULL;

  v_n := COALESCE(array_length(v_ids, 1), 0);
  IF v_n < 2 THEN RAISE EXCEPTION 'Need at least 2 players to make teams'; END IF;

  -- Odd headcount: default drops the trailing player (they don't ante).
  IF v_n % 2 = 1 AND p_odd_mode = 'leave_out' THEN
    v_ids := v_ids[1:v_n - 1];
    v_n := v_n - 1;
  END IF;

  -- Re-draw: clear any prior teams/members on this game.
  DELETE FROM public.game_players WHERE game_id = p_game_id;
  DELETE FROM public.game_teams   WHERE game_id = p_game_id;

  i := 1;
  WHILE i <= v_n LOOP
    v_t := v_t + 1;
    INSERT INTO public.game_teams (game_id, team_name, team_order)
      VALUES (p_game_id, 'Team ' || v_t, v_t) RETURNING id INTO v_team;

    PERFORM insert_game_player(p_game_id, v_team, v_ids[i]);
    IF i + 1 <= v_n THEN
      PERFORM insert_game_player(p_game_id, v_team, v_ids[i + 1]);
    END IF;
    -- team_of_3: exactly one player remains after this pair → fold in.
    IF p_odd_mode = 'team_of_3' AND i + 2 = v_n THEN
      PERFORM insert_game_player(p_game_id, v_team, v_ids[i + 2]);
      i := i + 1; -- consume the extra
    END IF;
    i := i + 2;
  END LOOP;

  RETURN v_t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
