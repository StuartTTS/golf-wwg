-- ============================================================
-- ADD ROSTER PLAYERS TO AN EXISTING ROUND (+ its games)
-- ============================================================
-- The round page could add ad-hoc guests (name + handicap) but not players from
-- the Commish's roster, and neither path added the new player to games already
-- created on the round. This RPC does both: for each roster entry it creates the
-- right round_players card (linked → the linked account, else a guest card,
-- mirroring createGameTimeRound) and adds them to every non-finalized game.
-- SECURITY DEFINER, gated to the round creator / group admin. Skips roster
-- entries already in the round. Returns the number added.
-- ============================================================

CREATE OR REPLACE FUNCTION add_roster_players_to_round(
  p_round_id  UUID,
  p_roster_ids UUID[]
) RETURNS INT AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_created_by UUID;
  v_group  UUID;
  v_tee    UUID;
  v_slope  NUMERIC;
  v_rp     RECORD;
  v_linked UUID;
  v_hcp    NUMERIC;
  v_ch     INT;
  v_new    UUID;
  v_added  INT := 0;
  v_game   UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT created_by, group_id, tee_box_id
    INTO v_created_by, v_group, v_tee
  FROM public.rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Round not found'; END IF;

  IF NOT (v_created_by = v_user OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = v_group AND gm.user_id = v_user AND gm.role = 'admin'
  )) THEN
    RAISE EXCEPTION 'Only the Commish or a group admin can add players';
  END IF;

  SELECT slope_rating INTO v_slope FROM public.tee_boxes WHERE id = v_tee;

  FOR v_rp IN
    SELECT id, display_name, handicap_index, linked_user_id
    FROM public.roster_players
    WHERE id = ANY(p_roster_ids) AND owner_id = v_user
  LOOP
    -- A roster entry counts as "linked" only to a DIFFERENT account than the
    -- caller (mirrors createGameTimeRound); otherwise it's added as a guest.
    v_linked := CASE
      WHEN v_rp.linked_user_id IS NOT NULL AND v_rp.linked_user_id <> v_user
      THEN v_rp.linked_user_id ELSE NULL END;

    -- Skip if already in the round (by roster entry or by linked account).
    IF EXISTS (
      SELECT 1 FROM public.round_players rp
      WHERE rp.round_id = p_round_id
        AND (rp.roster_player_id = v_rp.id
             OR (v_linked IS NOT NULL AND rp.user_id = v_linked))
    ) THEN CONTINUE; END IF;

    -- Handicap: linked account's current index if we have it, else roster value.
    IF v_linked IS NOT NULL THEN
      SELECT current_handicap_index INTO v_hcp FROM public.profiles WHERE id = v_linked;
      v_hcp := COALESCE(v_hcp, v_rp.handicap_index);
    ELSE
      v_hcp := v_rp.handicap_index;
    END IF;
    v_ch := CASE
      WHEN v_hcp IS NOT NULL AND v_slope IS NOT NULL
      THEN round(v_hcp * (v_slope / 113.0)) ELSE NULL END;

    INSERT INTO public.round_players (
      round_id, tee_box_id, handicap_index_at_round, course_handicap,
      playing_handicap, status, roster_player_id, user_id, guest_name,
      guest_handicap_index
    ) VALUES (
      p_round_id, v_tee, v_hcp, v_ch, v_ch, 'registered', v_rp.id, v_linked,
      CASE WHEN v_linked IS NULL THEN v_rp.display_name ELSE NULL END,
      CASE WHEN v_linked IS NULL THEN v_rp.handicap_index ELSE NULL END
    ) RETURNING id INTO v_new;

    -- Add them to every active (non-finalized) game on the round.
    FOR v_game IN
      SELECT id FROM public.games WHERE round_id = p_round_id AND status <> 'finalized'
    LOOP
      INSERT INTO public.game_players (game_id, player_id, round_player_id, playing_handicap)
      VALUES (v_game, v_linked, v_new, v_ch);
    END LOOP;

    v_added := v_added + 1;
  END LOOP;

  RETURN v_added;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
