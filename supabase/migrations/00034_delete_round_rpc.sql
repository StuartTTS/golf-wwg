-- ============================================================
-- DELETE ROUND (Commish / group admin) — robust RPC
-- ============================================================
-- The app-layer delete relied on RLS + a RETURNING/count check, which proved
-- flaky to read back reliably. This SECURITY DEFINER RPC does the authorization
-- explicitly (round creator or group admin) and then deletes — round_players,
-- scores, games, and tee_time_groups all cascade (verified). Returns whether a
-- row was deleted.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_round(p_round_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_created_by UUID;
  v_group      UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT created_by, group_id INTO v_created_by, v_group
  FROM public.rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF NOT (
    v_created_by = v_user
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = v_group AND gm.user_id = v_user AND gm.role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Only the Commish or a group admin can delete this round';
  END IF;

  DELETE FROM public.rounds WHERE id = p_round_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
