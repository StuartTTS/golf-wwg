-- ============================================================
-- CLAIM A SPOT WITH A HANDICAP (accept the organizer's, or your own)
-- ============================================================
-- When the organizer pre-adds a player they set a handicap, but if that player
-- signs up separately their (empty) account handicap effectively overwrote it —
-- the assigned value was lost. Now the join surfaces the assigned handicap, lets
-- the joiner accept or replace it, and it's written through to BOTH their
-- profile and their round card (so games/leaderboard use the right number).
-- ============================================================

-- Both signatures change (return columns / a new arg), which CREATE OR REPLACE
-- can't do — drop the old definitions first.
DROP FUNCTION IF EXISTS find_matched_guest_spot(UUID);
DROP FUNCTION IF EXISTS claim_guest_spot(UUID);

-- 1. Matched spot now also returns the assigned handicap so the UI can show it.
CREATE OR REPLACE FUNCTION find_matched_guest_spot(p_round_id UUID)
RETURNS TABLE(round_player_id UUID, guest_name TEXT, assigned_handicap NUMERIC) AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_email TEXT;
  v_phone TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.round_players
    WHERE round_id = p_round_id AND user_id = v_user
  ) THEN
    RETURN;
  END IF;

  SELECT NULLIF(lower(trim(email)), ''), public.normalize_phone(phone)
    INTO v_email, v_phone
  FROM public.profiles WHERE id = v_user;
  IF v_email IS NULL AND v_phone IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT g.id,
         COALESCE(g.guest_name, rp.display_name),
         COALESCE(g.guest_handicap_index, rp.handicap_index)
  FROM public.round_players g
  JOIN public.roster_players rp ON rp.id = g.roster_player_id
  WHERE g.round_id = p_round_id
    AND g.user_id IS NULL
    AND (
      (v_email IS NOT NULL AND lower(trim(rp.email)) = v_email)
      OR (v_phone IS NOT NULL AND public.normalize_phone(rp.phone) = v_phone)
    )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- 2. claim_guest_spot now takes an optional handicap to apply to the caller's
--    profile + round card. Merge logic is unchanged from 00039.
CREATE OR REPLACE FUNCTION claim_guest_spot(
  p_round_player_id UUID,
  p_handicap NUMERIC DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_round  UUID;
  v_owner  UUID;
  v_roster UUID;
  v_rp     UUID;
  v_slope  NUMERIC;
  v_ch     INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT round_id, user_id, roster_player_id
    INTO v_round, v_owner, v_roster
  FROM public.round_players WHERE id = p_round_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That spot no longer exists'; END IF;
  IF v_owner IS NOT NULL THEN RAISE EXCEPTION 'That spot is already taken'; END IF;

  SELECT id INTO v_rp
  FROM public.round_players
  WHERE round_id = v_round AND user_id = v_user
  LIMIT 1;
  IF v_rp IS NULL THEN RAISE EXCEPTION 'Join the round before claiming a spot'; END IF;
  IF v_rp = p_round_player_id THEN
    -- Already the same card; still apply the handicap if given.
    NULL;
  ELSE
    UPDATE public.game_players gp
      SET round_player_id = v_rp, player_id = v_user
    WHERE gp.round_player_id = p_round_player_id
      AND NOT EXISTS (
        SELECT 1 FROM public.game_players d
        WHERE d.game_id = gp.game_id AND d.id <> gp.id
          AND (d.player_id = v_user OR d.round_player_id = v_rp)
      );
    DELETE FROM public.game_players WHERE round_player_id = p_round_player_id;

    UPDATE public.scores s
      SET round_player_id = v_rp, player_id = v_user
    WHERE s.round_player_id = p_round_player_id
      AND NOT EXISTS (
        SELECT 1 FROM public.scores d
        WHERE d.round_id = s.round_id
          AND d.round_player_id = v_rp
          AND d.hole_number = s.hole_number
      );
    DELETE FROM public.scores WHERE round_player_id = p_round_player_id;

    IF v_roster IS NOT NULL THEN
      UPDATE public.roster_players rp
        SET linked_user_id = v_user, updated_at = now()
      WHERE rp.id = v_roster
        AND rp.linked_user_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.roster_players e
          WHERE e.owner_id = rp.owner_id AND e.linked_user_id = v_user
        );
    END IF;

    DELETE FROM public.round_players WHERE id = p_round_player_id;
  END IF;

  -- Apply the chosen handicap to the caller's profile + round card.
  IF p_handicap IS NOT NULL THEN
    UPDATE public.profiles SET current_handicap_index = p_handicap WHERE id = v_user;

    SELECT tb.slope_rating INTO v_slope
    FROM public.round_players rp
    JOIN public.tee_boxes tb ON tb.id = rp.tee_box_id
    WHERE rp.id = v_rp;
    v_ch := CASE WHEN v_slope IS NOT NULL
      THEN round(p_handicap * v_slope / 113.0) ELSE NULL END;

    UPDATE public.round_players
      SET handicap_index_at_round = p_handicap,
          course_handicap = COALESCE(v_ch, course_handicap),
          playing_handicap = COALESCE(v_ch, playing_handicap)
    WHERE id = v_rp;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
