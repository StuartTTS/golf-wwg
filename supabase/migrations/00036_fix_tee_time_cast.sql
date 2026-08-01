-- ============================================================
-- FIX: save_tee_time_groups tee_time type mismatch
-- ============================================================
-- The Lineup card (and the older Tee Time Groups manager) call this RPC to
-- rebuild a round's foursomes. It inserted `NULLIF(v_grp->>'teeTime', '')` into
-- tee_time, but `->>' yields TEXT and tee_time is TIME — Postgres won't
-- implicitly cast TEXT -> TIME, so every save failed with:
--   column "tee_time" is of type time without time zone but expression is of
--   type text
-- (The error fires even when teeTime is null, because the expression's type,
-- not its value, is what's checked.)
--
-- Fix: cast the extracted value to time. Only the INSERT line changes; the rest
-- of the function is unchanged from 00031.
-- ============================================================

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
      NULLIF(v_grp->>'teeTime', '')::time,
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
