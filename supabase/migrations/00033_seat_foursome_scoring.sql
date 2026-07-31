-- ============================================================
-- SEAT PLAYERS IN A FOURSOME (enables friction-free group scoring)
-- ============================================================
-- The secure "anyone in the foursome can keep score / take over" behavior needs
-- players to actually be seated in a foursome (tee_time_group). Same-foursome
-- scoring is already permitted by the scores RLS (00017) and the flight scorer
-- is claimable by any player in that flight (00031, claim_scorer). The only gap
-- was that casual Game Time rounds / GameID joiners weren't seated in a foursome
-- and fell to the Commish-only whole-round path.
--
-- This RPC seats the CALLER into the round's foursome — but ONLY when there is
-- exactly one, and only their own round_player row. It never creates a group,
-- never touches another player, and never flips round-wide scoring_mode, so it
-- adds no new authorization surface (a participant joining the single foursome
-- they're already playing in). Multi-foursome rounds are left to the Commish.
-- ============================================================

CREATE OR REPLACE FUNCTION seat_in_round_foursome(p_round_id UUID)
RETURNS UUID AS $$      -- the foursome the caller is now in, or NULL if none
DECLARE
  v_user    UUID := auth.uid();
  v_current UUID;
  v_found   BOOLEAN;
  v_group   UUID;
  v_count   INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT tee_time_group_id, TRUE INTO v_current, v_found
  FROM public.round_players
  WHERE round_id = p_round_id AND user_id = v_user
  LIMIT 1;
  IF v_found IS NULL THEN RAISE EXCEPTION 'You are not in this round'; END IF;

  -- Already seated — nothing to do.
  IF v_current IS NOT NULL THEN RETURN v_current; END IF;

  -- Seat into the round's foursome only when there's exactly one (unambiguous).
  SELECT count(*) INTO v_count FROM public.tee_time_groups WHERE round_id = p_round_id;
  IF v_count = 1 THEN
    SELECT id INTO v_group FROM public.tee_time_groups WHERE round_id = p_round_id LIMIT 1;
    UPDATE public.round_players
      SET tee_time_group_id = v_group
      WHERE round_id = p_round_id AND user_id = v_user;
    RETURN v_group;
  END IF;

  -- 0 or many foursomes → the Commish assigns groups; caller stays unseated.
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
