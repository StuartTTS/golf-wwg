-- ============================================================
-- S2 (HIGH) COMPLETE FIX — evict share-code memberships on finalize
-- ============================================================
-- Migration 00031 marked share-code group joins (group_members.joined_via_code).
-- A code join grants full parent-group access for as long as the membership
-- lasts, and previously that was permanent. Here we make it session-scoped:
-- when a round is finalized, any code-joined member whose only reason to be in
-- the group was an active round loses that membership. Real invited members
-- (joined_via_code = false) are never touched. This is the "auto-evict on
-- finalize" option from docs/review-2026-07-30.md (finding S2).
--
-- Access is retained while the user still has ANY non-finalized round in the
-- group (rounds.confirmed_at IS NULL), so multi-round guests are not cut off
-- mid-play. Once all their joined rounds are done, the Commish can re-invite
-- them properly for ongoing access.
-- ============================================================

CREATE OR REPLACE FUNCTION finalize_round(p_round_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_group UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT can_finalize_round(p_round_id, v_user) THEN
    RAISE EXCEPTION 'Only the Commish can finalize this round';
  END IF;

  SELECT group_id INTO v_group FROM public.rounds WHERE id = p_round_id;

  UPDATE public.round_players
    SET confirmed_at = COALESCE(confirmed_at, now()),
        confirmed_by = COALESCE(confirmed_by, v_user)
    WHERE round_id = p_round_id AND confirmed_at IS NULL;

  UPDATE public.rounds
    SET confirmed_at = now(), confirmed_by = v_user,
        status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = p_round_id;

  -- Revoke share-code memberships that no longer have an active round in this
  -- group. Only ever removes joined_via_code = true rows.
  IF v_group IS NOT NULL THEN
    DELETE FROM public.group_members gm
    WHERE gm.group_id = v_group
      AND gm.joined_via_code = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.round_players rp
        JOIN public.rounds r2 ON r2.id = rp.round_id
        WHERE rp.user_id = gm.user_id
          AND r2.group_id = v_group
          AND r2.confirmed_at IS NULL
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
