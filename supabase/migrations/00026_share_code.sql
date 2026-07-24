-- ============================================================
-- SHARE CODE / GAMEID — join a round by code (Phase 2)
-- ============================================================
-- A short code the Commish shares so friends can join a round to score + view.
-- Design (see docs/gameid-join-roles.md, and the weekend-scoped approach):
-- joining ADDS the authenticated user to the round's GROUP + as a round_player
-- via a SECURITY DEFINER RPC. Once they're a group member, every existing
-- (group-gated) RLS policy works unchanged — no anonymous access, no policy
-- rewrites. Everyone still signs up first; the code just authorizes the join.
-- ============================================================

ALTER TABLE rounds ADD COLUMN share_code TEXT UNIQUE;

-- 1. CODE GENERATOR ------------------------------------------------------
-- 6 chars from an unambiguous alphabet (no 0/O/1/I/L). ~887M combos.
CREATE OR REPLACE FUNCTION gen_share_code()
RETURNS TEXT AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. ENSURE A ROUND HAS A CODE (Commish / admin) ------------------------
CREATE OR REPLACE FUNCTION ensure_round_share_code(p_round_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user UUID := auth.uid();
  v_created_by UUID;
  v_group UUID;
  v_existing TEXT;
  v_code TEXT;
  v_try INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT created_by, group_id, share_code
    INTO v_created_by, v_group, v_existing
  FROM public.rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Round not found'; END IF;

  IF NOT (v_created_by = v_user OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = v_group AND gm.user_id = v_user AND gm.role = 'admin'
  )) THEN
    RAISE EXCEPTION 'Only the round creator or a group admin can create a share code';
  END IF;

  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  LOOP
    v_try := v_try + 1;
    v_code := gen_share_code();
    BEGIN
      UPDATE public.rounds SET share_code = v_code WHERE id = p_round_id;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_try > 10 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. JOIN BY CODE (any authenticated user) ------------------------------
-- Adds the caller to the round's group (member) + as a round_player, assigning
-- their preferred tee (default_tee_tier match) and computing course handicap.
-- Idempotent. Returns the round id.
CREATE OR REPLACE FUNCTION join_round_by_code(p_code TEXT)
RETURNS UUID AS $$
DECLARE
  v_user UUID := auth.uid();
  v_round_id UUID;
  v_group UUID;
  v_default_tee UUID;
  v_course UUID;
  v_tier INT;
  v_hcp NUMERIC;
  v_assigned_tee UUID;
  v_slope NUMERIC;
  v_course_hcp INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN RAISE EXCEPTION 'Enter a code'; END IF;

  SELECT id, group_id, tee_box_id, course_id
    INTO v_round_id, v_group, v_default_tee, v_course
  FROM public.rounds WHERE share_code = upper(trim(p_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'No game found for that code'; END IF;

  -- Join the group (idempotent) so existing group-gated RLS covers them.
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group, v_user, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- Already in this round? Done.
  IF EXISTS (
    SELECT 1 FROM public.round_players WHERE round_id = v_round_id AND user_id = v_user
  ) THEN
    RETURN v_round_id;
  END IF;

  SELECT default_tee_tier, current_handicap_index INTO v_tier, v_hcp
  FROM public.profiles WHERE id = v_user;

  v_assigned_tee := v_default_tee;
  IF v_tier IS NOT NULL THEN
    SELECT id INTO v_assigned_tee
    FROM public.tee_boxes
    WHERE course_id = v_course AND tier IS NOT NULL
    ORDER BY abs(tier - v_tier) ASC
    LIMIT 1;
    IF v_assigned_tee IS NULL THEN v_assigned_tee := v_default_tee; END IF;
  END IF;

  SELECT slope_rating INTO v_slope FROM public.tee_boxes WHERE id = v_assigned_tee;
  IF v_hcp IS NOT NULL AND v_slope IS NOT NULL THEN
    v_course_hcp := round(v_hcp * (v_slope / 113.0));
  END IF;

  INSERT INTO public.round_players
    (round_id, user_id, tee_box_id, handicap_index_at_round, course_handicap, playing_handicap, status)
  VALUES
    (v_round_id, v_user, v_assigned_tee, v_hcp, v_course_hcp, v_course_hcp, 'registered');

  RETURN v_round_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
