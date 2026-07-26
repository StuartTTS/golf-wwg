-- ============================================================
-- SELF-SERVICE SCORER  (Phase 2)
-- ============================================================
-- The Commish shouldn't have to pre-assign who keeps score for each group.
-- Instead any player can claim the scorer role for THEIR group, and hand it off
-- mid-round (someone leaves, only wants the front 9, etc.).
--
-- "Their group" = their flight (tee_time_groups.scorer_id) when they're in one,
-- otherwise the whole round (rounds.scorekeeper_id + scoring_mode). Both are
-- already understood by the score-entry gate, the score-lock RLS (00024), and
-- the confirm model (a flight scorer confirms the foursome; a whole-round
-- scorekeeper can confirm/finalize). See docs/gameid-join-roles.md.
--
-- SECURITY DEFINER: a player edits a tee-time group / round they don't own, but
-- only ever to set themselves (auth.uid()) as scorer of a round they play in.
-- ============================================================

-- Claim (or take over) the scorer role for the caller's group.
CREATE OR REPLACE FUNCTION claim_scorer(p_round_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_flight UUID;
  v_found  BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT tee_time_group_id, TRUE INTO v_flight, v_found
  FROM public.round_players
  WHERE round_id = p_round_id AND user_id = v_user
  LIMIT 1;
  IF v_found IS NULL THEN RAISE EXCEPTION 'You are not in this round'; END IF;

  IF v_flight IS NOT NULL THEN
    UPDATE public.tee_time_groups SET scorer_id = v_user WHERE id = v_flight;
  ELSE
    UPDATE public.rounds
      SET scorekeeper_id = v_user, scoring_mode = 'scorekeeper'
      WHERE id = p_round_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step back from scoring (only clears it if the caller currently holds it), so
-- the group falls back to everyone self-scoring until someone else claims.
CREATE OR REPLACE FUNCTION release_scorer(p_round_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_flight UUID;
  v_found  BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT tee_time_group_id, TRUE INTO v_flight, v_found
  FROM public.round_players
  WHERE round_id = p_round_id AND user_id = v_user
  LIMIT 1;
  IF v_found IS NULL THEN RAISE EXCEPTION 'You are not in this round'; END IF;

  IF v_flight IS NOT NULL THEN
    UPDATE public.tee_time_groups
      SET scorer_id = NULL
      WHERE id = v_flight AND scorer_id = v_user;
  ELSE
    UPDATE public.rounds
      SET scorekeeper_id = NULL, scoring_mode = 'shared'
      WHERE id = p_round_id AND scorekeeper_id = v_user;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
