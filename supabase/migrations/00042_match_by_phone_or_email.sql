-- ============================================================
-- AUTO-MATCH A JOINER BY PHONE OR EMAIL
-- ============================================================
-- Email alone is a fragile match key (people have several, or use a different
-- one than the organizer entered). Phone is a more durable identifier. Extend
-- the join auto-claim to link a roster entry when the joiner's normalized PHONE
-- or email matches — both already stored on roster_players and profiles, and the
-- join flow already collects phone.
-- ============================================================

-- Normalize a phone to its last 10 digits (drops formatting + a country-code 1),
-- or NULL when there aren't enough digits to match on reliably.
CREATE OR REPLACE FUNCTION normalize_phone(p TEXT)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN length(regexp_replace(COALESCE(p, ''), '\D', '', 'g')) >= 10
    THEN right(regexp_replace(p, '\D', '', 'g'), 10)
    ELSE NULL
  END;
$$ LANGUAGE sql IMMUTABLE;

-- Re-defines claim_roster_by_email (from 00039) with the ONLY change being the
-- Step 1 match: email OR normalized phone. Everything downstream (game_players
-- re-point, guest de-dup, promote, backfill) is unchanged.
CREATE OR REPLACE FUNCTION claim_roster_by_email()
RETURNS INT AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_email   TEXT;
  v_phone   TEXT;
  v_claimed INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT NULLIF(lower(trim(email)), ''), public.normalize_phone(phone)
    INTO v_email, v_phone
  FROM public.profiles WHERE id = v_user;
  IF v_email IS NULL AND v_phone IS NULL THEN RETURN 0; END IF;

  -- 1. Link matching unlinked roster entries (by email OR phone) to the caller.
  UPDATE public.roster_players rp
    SET linked_user_id = v_user, updated_at = now()
  WHERE rp.linked_user_id IS NULL
    AND (
      (v_email IS NOT NULL AND lower(trim(rp.email)) = v_email)
      OR (v_phone IS NOT NULL AND public.normalize_phone(rp.phone) = v_phone)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.roster_players e
      WHERE e.owner_id = rp.owner_id AND e.linked_user_id = v_user
    );
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  -- 1b. Keep game memberships alive: re-point the empty guest card's game_players
  --     onto the caller's real card BEFORE 2a deletes the card.
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

  -- 2a. Drop redundant EMPTY guest placeholders (caller already has a real card).
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

  -- 2c. Backfill game_players.player_id for cards the caller now owns.
  UPDATE public.game_players gp
    SET player_id = v_user
  WHERE gp.player_id IS NULL
    AND gp.round_player_id IN (
      SELECT id FROM public.round_players WHERE user_id = v_user
    );

  RETURN v_claimed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
