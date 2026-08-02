-- ============================================================
-- TIE A GAMEID JOINER TO THEIR EXISTING SPOT (roster + games)
-- ============================================================
-- When someone the Commish pre-added (a guest card wired into games) joins by
-- code, they should keep that spot. Two fixes:
--   A. claim_roster_by_email lost game memberships: its 2a DELETE of the empty
--      guest card cascade-deleted the guest's game_players (FK ON DELETE CASCADE,
--      00015). Re-point those to the caller's real card BEFORE the delete.
--   B. Email is the only tie today. Add claim_guest_spot() so a joiner can
--      explicitly claim their guest spot when the email doesn't match.
-- ============================================================

-- A. Patched email claim — preserve game memberships ---------------------
CREATE OR REPLACE FUNCTION claim_roster_by_email()
RETURNS INT AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_email   TEXT;
  v_claimed INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT lower(trim(email)) INTO v_email FROM public.profiles WHERE id = v_user;
  IF v_email IS NULL OR v_email = '' THEN RETURN 0; END IF;

  -- 1. Link matching unlinked roster entries to the caller.
  UPDATE public.roster_players rp
    SET linked_user_id = v_user, updated_at = now()
  WHERE rp.linked_user_id IS NULL
    AND lower(trim(rp.email)) = v_email
    AND NOT EXISTS (
      SELECT 1 FROM public.roster_players e
      WHERE e.owner_id = rp.owner_id AND e.linked_user_id = v_user
    );
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  -- 1b. Keep game memberships alive: re-point the empty guest card's game_players
  --     onto the caller's real card BEFORE 2a deletes the card (else the
  --     ON DELETE CASCADE on game_players.round_player_id drops them). Skip games
  --     the caller is somehow already in to avoid duplicate rows.
  UPDATE public.game_players gp
    SET round_player_id = r.id, player_id = v_user
  FROM public.round_players g
  JOIN public.round_players r
    ON r.round_id = g.round_id AND r.user_id = v_user
  WHERE gp.round_player_id = g.id
    AND g.user_id IS NULL
    AND g.roster_player_id IN (
      SELECT id FROM public.roster_players WHERE linked_user_id = v_user
    )
    AND NOT EXISTS (SELECT 1 FROM public.scores s WHERE s.round_player_id = g.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.game_players d
      WHERE d.game_id = gp.game_id AND d.id <> gp.id
        AND (d.player_id = v_user OR d.round_player_id = r.id)
    );

  -- 2a. Drop redundant EMPTY guest placeholders (caller already has a real card,
  --     guest card carries no scores). Game memberships were moved in 1b.
  DELETE FROM public.round_players g
  WHERE g.user_id IS NULL
    AND g.roster_player_id IN (
      SELECT id FROM public.roster_players WHERE linked_user_id = v_user
    )
    AND EXISTS (
      SELECT 1 FROM public.round_players r
      WHERE r.round_id = g.round_id AND r.user_id = v_user
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.scores s WHERE s.round_player_id = g.id
    );

  -- 2b. Promote the remaining guest placeholders (caller has NO real card yet).
  WITH candidates AS (
    SELECT DISTINCT ON (g.round_id) g.id
    FROM public.round_players g
    WHERE g.user_id IS NULL
      AND g.roster_player_id IN (
        SELECT id FROM public.roster_players WHERE linked_user_id = v_user
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.round_players r
        WHERE r.round_id = g.round_id AND r.user_id = v_user
      )
    ORDER BY g.round_id, g.id
  ),
  promoted AS (
    UPDATE public.round_players g
      SET user_id = v_user, status = 'registered'
    FROM candidates c
    WHERE g.id = c.id
    RETURNING g.id
  )
  UPDATE public.scores s
    SET player_id = v_user
  FROM promoted p
  WHERE s.round_player_id = p.id;

  -- 2c. Backfill game_players.player_id for cards the caller now owns (promoted
  --     guest cards keep their round_player_id but had a NULL player_id).
  UPDATE public.game_players gp
    SET player_id = v_user
  WHERE gp.player_id IS NULL
    AND gp.round_player_id IN (
      SELECT id FROM public.round_players WHERE user_id = v_user
    );

  RETURN v_claimed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- B. Explicit "claim your spot" (email-independent) ---------------------
-- The caller (a round participant, having joined by code) claims an unclaimed
-- guest card: its game memberships + scores move onto the caller's real card,
-- the roster entry links, and the guest card is removed. Merging onto the real
-- card keeps the caller's proper tee/handicap/foursome.
CREATE OR REPLACE FUNCTION claim_guest_spot(p_round_player_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_round  UUID;
  v_owner  UUID;   -- guest card's current user_id (must be NULL)
  v_roster UUID;
  v_rp     UUID;   -- caller's real card in the round
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
  IF v_rp = p_round_player_id THEN RETURN; END IF;

  -- Move game memberships (keep team_id) onto the real card; skip games the
  -- caller is already in, then drop any leftovers.
  UPDATE public.game_players gp
    SET round_player_id = v_rp, player_id = v_user
  WHERE gp.round_player_id = p_round_player_id
    AND NOT EXISTS (
      SELECT 1 FROM public.game_players d
      WHERE d.game_id = gp.game_id AND d.id <> gp.id
        AND (d.player_id = v_user OR d.round_player_id = v_rp)
    );
  DELETE FROM public.game_players WHERE round_player_id = p_round_player_id;

  -- Move any scores the guest card carried onto the real card (skip holes the
  -- real card already has), then drop leftovers.
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

  -- Link the roster entry to the caller (best effort, no conflict).
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
