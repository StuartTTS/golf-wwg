-- ============================================================
-- PREVIEW JOIN CLAIM  (Phase 2 — join UX polish)
-- ============================================================
-- When a fresh account joins a game by code and fills in the inline profile,
-- the roster-claim de-dup (claim_roster_by_email, 00029) only fires if the email
-- they type matches the email the organizer added them under. If they use a
-- different email, they end up as a SECOND card in the round.
--
-- This read-only helper lets the join screen reassure the joiner *before* they
-- save: given a round they're already in and a candidate email, it returns the
-- name of the unlinked guest card in that round whose roster entry matches — so
-- the UI can show "You'll be linked to <name>'s spot." No match → NULL.
--
-- SECURITY DEFINER because the match key lives on roster_players.email (owner-
-- only RLS, so the joiner can't read it directly). Scoped tightly:
--   * caller must already be a participant of p_round_id (they just joined by
--     code), so this can't be used to probe emails against arbitrary rounds;
--   * it only ever confirms an EXACT email match and returns a guest display
--     name that is already visible on that round's player list — no enumeration,
--     no new information disclosed.
-- ============================================================

CREATE OR REPLACE FUNCTION preview_join_claim(p_round_id UUID, p_email TEXT)
RETURNS TEXT AS $$      -- guest display name to be linked, or NULL if no match
DECLARE
  v_user  UUID := auth.uid();
  v_email TEXT := lower(trim(coalesce(p_email, '')));
  v_name  TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;
  IF v_email = '' THEN RETURN NULL; END IF;

  -- Only participants of this round may preview (they joined by code already).
  IF NOT EXISTS (
    SELECT 1 FROM public.round_players
    WHERE round_id = p_round_id AND user_id = v_user
  ) THEN
    RETURN NULL;
  END IF;

  -- An unlinked guest card in this round whose roster entry matches the email.
  SELECT coalesce(g.guest_name, rp.display_name)
    INTO v_name
  FROM public.round_players g
  JOIN public.roster_players rp ON rp.id = g.roster_player_id
  WHERE g.round_id = p_round_id
    AND g.user_id IS NULL
    AND rp.linked_user_id IS NULL
    AND lower(trim(rp.email)) = v_email
  LIMIT 1;

  RETURN v_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
