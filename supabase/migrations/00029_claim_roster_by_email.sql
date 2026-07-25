-- ============================================================
-- ROSTER CLAIM BY EMAIL  (Phase 2)
-- ============================================================
-- email is the durable claim key (see 00025). When a person finishes setting up
-- their profile — notably right after joining a game by GameID — any UNLINKED
-- roster entries other people added for that email become LINKED to the new
-- account, and the throwaway "guest" round cards created from those entries are
-- reconciled so the person isn't duplicated in the round.
--
-- SECURITY DEFINER because this crosses roster owners (owner-only RLS would
-- otherwise hide their entries) — but it only ever links entries to the CALLER
-- (auth.uid()) matched on the caller's own verified profile email.
-- ============================================================

CREATE OR REPLACE FUNCTION claim_roster_by_email()
RETURNS INT AS $$      -- number of roster entries newly linked to the caller
DECLARE
  v_user    UUID := auth.uid();
  v_email   TEXT;
  v_claimed INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT lower(trim(email)) INTO v_email FROM public.profiles WHERE id = v_user;
  IF v_email IS NULL OR v_email = '' THEN RETURN 0; END IF;

  -- 1. LINK matching unlinked entries. Skip any owner that already has a linked
  --    entry for this user (would violate the unique (owner_id, linked_user_id)).
  UPDATE public.roster_players rp
    SET linked_user_id = v_user, updated_at = now()
  WHERE rp.linked_user_id IS NULL
    AND lower(trim(rp.email)) = v_email
    AND NOT EXISTS (
      SELECT 1 FROM public.roster_players e
      WHERE e.owner_id = rp.owner_id AND e.linked_user_id = v_user
    );
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  -- 2a. Drop redundant EMPTY guest placeholders: rounds where the caller already
  --     has a real (user_id) card, so the guest card from their roster entry is a
  --     duplicate. Only when it carries no scores — never destroy score data.
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

  -- 2b. Promote the remaining guest placeholders (rounds where the caller has NO
  --     real card yet) to the caller, keeping their flight + any scores. Re-key
  --     those scores' player_id from the guest card id to the user id so member
  --     lookups resolve. One card per round (DISTINCT ON) to avoid a dup user_id.
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

  RETURN v_claimed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
