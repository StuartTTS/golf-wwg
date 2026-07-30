-- ============================================================
-- SECURITY REVIEW FIXES (2026-07-30)  — see docs/review-2026-07-30.md
-- ============================================================
-- Addresses findings S1, S4, S5, S6 (RLS/authorization), a mitigation for S2
-- (share-code over-grant), and P4 (transactional tee-time-group save).
-- ============================================================

-- ------------------------------------------------------------
-- S1 (CRITICAL): prevent self-escalation to site admin.
-- The profiles UPDATE policy had no WITH CHECK, so a user could PATCH their own
-- row setting is_site_admin = true. RLS cannot compare OLD vs NEW, so we use a
-- BEFORE UPDATE trigger: only an existing site admin (or a service-role/no-JWT
-- connection) may change is_site_admin. Also re-assert the row-owner WITH CHECK.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION prevent_site_admin_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_site_admin IS DISTINCT FROM OLD.is_site_admin THEN
    -- auth.uid() IS NULL => service-role / trusted server connection (allowed).
    -- Otherwise the caller must already be a site admin.
    IF auth.uid() IS NOT NULL
       AND NOT COALESCE(
         (SELECT p.is_site_admin FROM public.profiles p WHERE p.id = auth.uid()),
         false
       ) THEN
      RAISE EXCEPTION 'Only a site admin may change is_site_admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_site_admin_escalation ON profiles;
CREATE TRIGGER trg_prevent_site_admin_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_site_admin_escalation();

-- ------------------------------------------------------------
-- S4 (MEDIUM): the shared-mode scores UPDATE policy had a USING clause but no
-- WITH CHECK, so an updated row was not re-validated. Re-create it with an
-- identical WITH CHECK. (Shared-mode cross-player entry remains intended for
-- casual scoring; the scorekeeper/flight-scorer modes are the controlled paths.)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Round players can update scores" ON scores;
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
  )
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

-- ------------------------------------------------------------
-- S5 (MEDIUM): claim_scorer let ANY participant flip a whole round into
-- scorekeeper mode, locking everyone else out. Restrict the whole-round takeover
-- to the Commish / group admin (can_finalize_round). Claiming a FLIGHT's scorer
-- role stays open to any player in that flight (it only affects their foursome).
-- ------------------------------------------------------------
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
    -- Flipping the whole round to scorekeeper mode locks other players out of
    -- entering their own scores, so only the Commish/admin may do it.
    IF NOT can_finalize_round(p_round_id, v_user) THEN
      RAISE EXCEPTION 'Only the Commish can take over scoring for the whole round';
    END IF;
    UPDATE public.rounds
      SET scorekeeper_id = v_user, scoring_mode = 'scorekeeper'
      WHERE id = p_round_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- S6 (LOW): the group_members INSERT "first member" branch didn't restrict the
-- inserted user_id, so an emptied group could be claimed by anyone (as any role,
-- for any user). Constrain the first-member branch to the caller themselves.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Group admins can insert members" ON group_members;
CREATE POLICY "Group admins can insert members"
  ON group_members FOR INSERT
  WITH CHECK (
    is_group_admin(group_id)
    OR (
      group_members.user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id
      )
    )
  );

-- ------------------------------------------------------------
-- S2 (HIGH) — mitigation: mark share-code joins. join_round_by_code adds the
-- caller to the parent group so existing group-gated RLS covers them; this flag
-- records that the membership came from a code (not a real invite) so it can be
-- identified/managed. Full round-scoped access remains a recommended follow-up.
-- ------------------------------------------------------------
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS joined_via_code BOOLEAN NOT NULL DEFAULT false;

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

  -- Join the group (idempotent). Mark as code-join ONLY when creating the row —
  -- never downgrade an existing real membership.
  INSERT INTO public.group_members (group_id, user_id, role, joined_via_code)
  VALUES (v_group, v_user, 'member', true)
  ON CONFLICT (group_id, user_id) DO NOTHING;

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

-- ------------------------------------------------------------
-- P4: transactional tee-time-group save. Replaces the app-side clear+rebuild
-- (which was non-transactional, unchecked, and interpolated player ids into a
-- PostgREST .or() filter — S10). A plpgsql function is atomic: a failure rolls
-- back the whole save, so a round's foursomes can never be left half-wiped.
-- p_groups is a JSONB array of { name, teeTime, playerIds: [] } where each
-- playerId is either a round_players.user_id or a round_players.id (guests).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION save_tee_time_groups(p_round_id UUID, p_groups JSONB)
RETURNS VOID AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_group_id UUID;
  v_grp      JSONB;
  v_new_id   UUID;
  v_idx      INT := 0;
  v_player   TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT group_id INTO v_group_id FROM public.rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Round not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = v_group_id AND gm.user_id = v_user AND gm.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.round_players SET tee_time_group_id = NULL WHERE round_id = p_round_id;
  DELETE FROM public.tee_time_groups WHERE round_id = p_round_id;

  FOR v_grp IN SELECT jsonb_array_elements(COALESCE(p_groups, '[]'::jsonb))
  LOOP
    IF jsonb_array_length(COALESCE(v_grp->'playerIds', '[]'::jsonb)) = 0 THEN
      v_idx := v_idx + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.tee_time_groups (round_id, name, tee_time, sort_order)
    VALUES (
      p_round_id,
      COALESCE(NULLIF(v_grp->>'name', ''), 'Group'),
      NULLIF(v_grp->>'teeTime', ''),
      v_idx
    )
    RETURNING id INTO v_new_id;

    FOR v_player IN SELECT jsonb_array_elements_text(v_grp->'playerIds')
    LOOP
      UPDATE public.round_players
        SET tee_time_group_id = v_new_id
        WHERE round_id = p_round_id
          AND (user_id::text = v_player OR id::text = v_player);
    END LOOP;

    v_idx := v_idx + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
