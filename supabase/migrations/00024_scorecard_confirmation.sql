-- ============================================================
-- SCORECARD CONFIRMATION & GAME FINALIZATION
-- ============================================================
-- Three tiers of confirmation, matching how a group actually scores:
--
--   1. SCORECARD (per player) — a player may enter AND confirm their OWN
--      score/stats at ANY time, even inside a scorer-led foursome (so
--      non-scorers can still track & attest their personal stats). A card
--      may also be confirmed by that flight's scorer, the round scorekeeper,
--      or the Commish/admin. Confirming LOCKS the card from edits.
--
--   2. FOURSOME (per flight) — the flight's designated scorer confirms the
--      foursome, i.e. attests the official game scores for their group.
--      (confirm_flight = bulk of tier 1 over the flight's cards.)
--
--   3. GAME (per round) — the Commish gives the FINAL sign-off
--      (finalize_round), which auto-confirms any stragglers and stamps
--      rounds.confirmed_at. A round counts toward stats/handicap and the
--      game is settled ONLY when finalized. status='completed' is derived
--      purely from rounds.confirmed_at.
--
-- Unlock is the mirror: a player can unlock their own card; the flight
-- scorer / Commish can unlock any card; the Commish can unfinalize the game.
-- ============================================================

-- 1. CONFIRMATION STATE --------------------------------------------------
ALTER TABLE round_players
  ADD COLUMN confirmed_at TIMESTAMPTZ,
  ADD COLUMN confirmed_by UUID REFERENCES profiles(id);

ALTER TABLE rounds
  ADD COLUMN confirmed_at TIMESTAMPTZ,          -- Commish's final game sign-off
  ADD COLUMN confirmed_by UUID REFERENCES profiles(id);

-- Existing completed rounds are already "final" — keep them counting.
UPDATE rounds SET confirmed_at = COALESCE(completed_at, now())
WHERE status = 'completed' AND confirmed_at IS NULL;

-- 2. SCORECARD AUTHORITY -------------------------------------------------
-- TRUE if p_user may confirm/unlock the given scorecard. Note: SELF is
-- always allowed — this is what lets a non-scorer attest their own card.
CREATE OR REPLACE FUNCTION can_manage_scorecard(p_round_player_id UUID, p_user UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_card_user    UUID;
  v_flight_id    UUID;
  v_round_id     UUID;
  v_created_by   UUID;
  v_group_id     UUID;
  v_scoring_mode TEXT;
  v_scorekeeper  UUID;
BEGIN
  SELECT rp.user_id, rp.tee_time_group_id, r.id, r.created_by,
         r.group_id, r.scoring_mode, r.scorekeeper_id
    INTO v_card_user, v_flight_id, v_round_id, v_created_by,
         v_group_id, v_scoring_mode, v_scorekeeper
  FROM public.round_players rp
  JOIN public.rounds r ON r.id = rp.round_id
  WHERE rp.id = p_round_player_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Self — always (own card, own stats)
  IF v_card_user = p_user THEN RETURN TRUE; END IF;

  -- Commish (round creator) / group admin — universal
  IF v_created_by = p_user THEN RETURN TRUE; END IF;
  IF EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = v_group_id AND gm.user_id = p_user AND gm.role = 'admin'
  ) THEN RETURN TRUE; END IF;

  -- Round scorekeeper
  IF v_scoring_mode = 'scorekeeper' AND v_scorekeeper = p_user THEN RETURN TRUE; END IF;

  -- This card's flight scorer
  IF v_flight_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tee_time_groups ttg
    WHERE ttg.id = v_flight_id AND ttg.scorer_id = p_user
  ) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Round-level authority: who may finalize / unfinalize the game.
CREATE OR REPLACE FUNCTION can_finalize_round(p_round_id UUID, p_user UUID)
RETURNS BOOLEAN AS $$
DECLARE v_created_by UUID; v_group_id UUID; v_mode TEXT; v_sk UUID;
BEGIN
  SELECT created_by, group_id, scoring_mode, scorekeeper_id
    INTO v_created_by, v_group_id, v_mode, v_sk
  FROM public.rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  RETURN v_created_by = p_user
    OR (v_mode = 'scorekeeper' AND v_sk = p_user)
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = v_group_id AND gm.user_id = p_user AND gm.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 3. TIER 1 — SCORECARD CONFIRM / UNLOCK --------------------------------
CREATE OR REPLACE FUNCTION confirm_scorecard(p_round_player_id UUID)
RETURNS VOID AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT can_manage_scorecard(p_round_player_id, v_user) THEN
    RAISE EXCEPTION 'Not authorized to confirm this scorecard';
  END IF;
  UPDATE public.round_players
    SET confirmed_at = now(), confirmed_by = v_user
    WHERE id = p_round_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION unlock_scorecard(p_round_player_id UUID)
RETURNS VOID AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT can_manage_scorecard(p_round_player_id, v_user) THEN
    RAISE EXCEPTION 'Not authorized to unlock this scorecard';
  END IF;
  UPDATE public.round_players
    SET confirmed_at = NULL, confirmed_by = NULL
    WHERE id = p_round_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. TIER 2 — FOURSOME (FLIGHT) CONFIRM ---------------------------------
-- The flight's scorer (or Commish/admin) confirms every card in the flight.
CREATE OR REPLACE FUNCTION confirm_flight(p_tee_time_group_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user UUID := auth.uid();
  v_round_id UUID; v_scorer UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT round_id, scorer_id INTO v_round_id, v_scorer
  FROM public.tee_time_groups WHERE id = p_tee_time_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Flight not found'; END IF;

  IF NOT (v_scorer = v_user OR can_finalize_round(v_round_id, v_user)) THEN
    RAISE EXCEPTION 'Only the flight scorer or Commish can confirm this foursome';
  END IF;

  UPDATE public.round_players
    SET confirmed_at = COALESCE(confirmed_at, now()),
        confirmed_by = COALESCE(confirmed_by, v_user)
    WHERE tee_time_group_id = p_tee_time_group_id AND confirmed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. TIER 3 — GAME FINALIZE / UNFINALIZE (Commish) ----------------------
-- Final sign-off: auto-confirm any open cards, stamp the round. This is the
-- ONLY thing that makes a round count (status='completed').
CREATE OR REPLACE FUNCTION finalize_round(p_round_id UUID)
RETURNS VOID AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT can_finalize_round(p_round_id, v_user) THEN
    RAISE EXCEPTION 'Only the Commish can finalize this round';
  END IF;

  UPDATE public.round_players
    SET confirmed_at = COALESCE(confirmed_at, now()),
        confirmed_by = COALESCE(confirmed_by, v_user)
    WHERE round_id = p_round_id AND confirmed_at IS NULL;

  UPDATE public.rounds
    SET confirmed_at = now(), confirmed_by = v_user,
        status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = p_round_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Reopen the whole game. Cards stay individually confirmed/locked until
-- someone unlocks the specific card to edit it.
CREATE OR REPLACE FUNCTION unfinalize_round(p_round_id UUID)
RETURNS VOID AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT can_finalize_round(p_round_id, v_user) THEN
    RAISE EXCEPTION 'Only the Commish can reopen this round';
  END IF;

  UPDATE public.rounds
    SET confirmed_at = NULL, confirmed_by = NULL,
        status = 'in_progress', completed_at = NULL
    WHERE id = p_round_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. LOCK ENFORCEMENT ON SCORES -----------------------------------------
-- A score write (strokes + shot stats) is blocked when the round is
-- finalized OR the specific target card is confirmed.
CREATE OR REPLACE FUNCTION score_target_locked(
  p_round_id UUID, p_player_id UUID, p_round_player_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = p_round_id AND r.confirmed_at IS NOT NULL
    ) OR EXISTS (
      SELECT 1 FROM public.round_players rp
      WHERE rp.round_id = p_round_id
        AND rp.confirmed_at IS NOT NULL
        AND (rp.id = p_round_player_id OR rp.user_id = p_player_id)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Re-create the 00017 INSERT/UPDATE score policies with the not-locked guard.
DROP POLICY IF EXISTS "Round players can insert scores" ON scores;
DROP POLICY IF EXISTS "Round players can update scores" ON scores;

CREATE POLICY "Round players can insert scores"
  ON scores FOR INSERT TO authenticated
  WITH CHECK (
    NOT score_target_locked(scores.round_id, scores.player_id, scores.round_player_id)
    AND (
      EXISTS (
        SELECT 1 FROM rounds r
        JOIN round_players rp ON rp.round_id = r.id
        WHERE r.id = scores.round_id AND r.scoring_mode = 'shared' AND rp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM rounds r
        WHERE r.id = scores.round_id AND r.scoring_mode = 'scorekeeper' AND r.scorekeeper_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM round_players scorer
        JOIN round_players target ON target.round_id = scorer.round_id
        WHERE scorer.round_id = scores.round_id
          AND scorer.user_id = auth.uid()
          AND scorer.tee_time_group_id IS NOT NULL
          AND scorer.tee_time_group_id = target.tee_time_group_id
          AND (target.user_id = scores.player_id OR target.id::text = scores.player_id::text)
      )
      OR scores.player_id = auth.uid()
    )
  );

CREATE POLICY "Round players can update scores"
  ON scores FOR UPDATE TO authenticated
  USING (
    NOT score_target_locked(scores.round_id, scores.player_id, scores.round_player_id)
    AND (
      EXISTS (
        SELECT 1 FROM rounds r
        JOIN round_players rp ON rp.round_id = r.id
        WHERE r.id = scores.round_id AND r.scoring_mode = 'shared' AND rp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM rounds r
        WHERE r.id = scores.round_id AND r.scoring_mode = 'scorekeeper' AND r.scorekeeper_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM round_players scorer
        JOIN round_players target ON target.round_id = scorer.round_id
        WHERE scorer.round_id = scores.round_id
          AND scorer.user_id = auth.uid()
          AND scorer.tee_time_group_id IS NOT NULL
          AND scorer.tee_time_group_id = target.tee_time_group_id
          AND (target.user_id = scores.player_id OR target.id::text = scores.player_id::text)
      )
      OR scores.player_id = auth.uid()
    )
  );
