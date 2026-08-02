-- ============================================================
-- REMOVE A PLAYER FROM A ROUND  (roster management)
-- ============================================================
-- Lets the Commish (round creator) or a group admin drop a player from a round
-- after it's been set up — e.g. to clear a duplicate. SECURITY DEFINER for the
-- same reliability reason as delete_round (00034): a direct client DELETE is at
-- the mercy of round_players RLS. Deleting the round_players row cascades the
-- player's scores and game_players (both round_player_id ON DELETE CASCADE,
-- 00015), so this also pulls them out of every game/team on the round.
-- ============================================================

CREATE OR REPLACE FUNCTION remove_round_player(p_round_player_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_round      UUID;
  v_created_by UUID;
  v_group      UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT rp.round_id, r.created_by, r.group_id
    INTO v_round, v_created_by, v_group
  FROM public.round_players rp
  JOIN public.rounds r ON r.id = rp.round_id
  WHERE rp.id = p_round_player_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT (v_created_by = v_user OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = v_group AND gm.user_id = v_user AND gm.role = 'admin'
  )) THEN
    RAISE EXCEPTION 'Only the Commish or a group admin can remove players';
  END IF;

  DELETE FROM public.round_players WHERE id = p_round_player_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
