-- ============================================================
-- FIND THE GUEST SPOT THAT MATCHES THE JOINER (email or phone)
-- ============================================================
-- When the auto-claim can't merge silently (the pre-added guest card already has
-- scores, so we won't destroy them), the joiner has to confirm the merge. Rather
-- than make them scan a list of every pre-added player, this finds the ONE spot
-- their email/phone matches so the UI can jump straight to "You're <name> —
-- confirm." SECURITY DEFINER because the match key lives on owner-only
-- roster_players; scoped to a round the caller is already in.
-- ============================================================

CREATE OR REPLACE FUNCTION find_matched_guest_spot(p_round_id UUID)
RETURNS TABLE(round_player_id UUID, guest_name TEXT) AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_email TEXT;
  v_phone TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;

  -- Caller must be a participant of the round (they just joined by code).
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
  SELECT g.id, COALESCE(g.guest_name, rp.display_name)
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
