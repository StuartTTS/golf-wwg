-- WHS Course Handicap: use the full formula everywhere.
--
-- Course Handicap = Index × (Slope / 113) + (Course Rating − Par)
--
-- The app previously computed only `Index × Slope / 113`, omitting the
-- (Course Rating − Par) term. On tees whose rating differs from par (e.g. a
-- Gold tee rated 68.3 against par 72) that made every net ~4 strokes too
-- generous and disagreed with Golf Genius / any WHS-compliant scorer.
--
-- Fix, in one place: a BEFORE INSERT/UPDATE trigger on round_players is the
-- single source of truth for course_handicap / playing_handicap. Every write
-- path — the JS server actions AND the RPCs (join_round_by_code,
-- add_roster_players_to_round, claim_guest_spot) — now yields the same,
-- correct number, so we don't have to chase each call site.

-- 1) Par per tee. Needed for the (Course Rating − Par) term. Par is the sum of
--    the tee's hole pars (falls back to NULL when a tee has no holes yet, in
--    which case the rating term is dropped and we degrade to the old formula).
ALTER TABLE public.tee_boxes ADD COLUMN IF NOT EXISTS par INTEGER;

UPDATE public.tee_boxes tb
SET par = sub.total_par
FROM (
  SELECT tee_box_id, SUM(par) AS total_par
  FROM public.holes
  GROUP BY tee_box_id
) sub
WHERE tb.id = sub.tee_box_id;

-- 2) The trigger function. floor(x + 0.5) matches JS Math.round exactly, so the
--    DB and the (optimistic) client agree. When the index or tee is unknown we
--    leave the handicap columns untouched (typically NULL).
CREATE OR REPLACE FUNCTION public.set_round_player_course_handicap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_idx   NUMERIC;
  v_slope NUMERIC;
  v_cr    NUMERIC;
  v_par   INTEGER;
  v_ch    INTEGER;
BEGIN
  v_idx := COALESCE(NEW.handicap_index_at_round, NEW.guest_handicap_index);

  IF v_idx IS NULL OR NEW.tee_box_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tb.slope_rating, tb.course_rating, tb.par
    INTO v_slope, v_cr, v_par
    FROM public.tee_boxes tb
   WHERE tb.id = NEW.tee_box_id;

  IF v_slope IS NULL THEN
    RETURN NEW;
  END IF;

  -- COALESCE(v_cr - v_par, 0): if the tee lacks a rating or par, drop the term.
  v_ch := floor(v_idx * (v_slope / 113.0) + COALESCE(v_cr - v_par, 0) + 0.5);

  NEW.course_handicap  := v_ch;
  NEW.playing_handicap := v_ch;  -- game-format allowances (if any) applied downstream
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_round_player_course_handicap ON public.round_players;
CREATE TRIGGER trg_round_player_course_handicap
  BEFORE INSERT OR UPDATE ON public.round_players
  FOR EACH ROW
  EXECUTE FUNCTION public.set_round_player_course_handicap();

-- 3) Backfill every existing round (all statuses) with the corrected handicap.
UPDATE public.round_players rp
SET course_handicap  = sub.ch,
    playing_handicap = sub.ch
FROM (
  SELECT rp2.id,
         floor(
           COALESCE(rp2.handicap_index_at_round, rp2.guest_handicap_index)
             * (tb.slope_rating / 113.0)
           + COALESCE(tb.course_rating - tb.par, 0)
           + 0.5
         )::int AS ch
  FROM public.round_players rp2
  JOIN public.tee_boxes tb ON tb.id = rp2.tee_box_id
  WHERE COALESCE(rp2.handicap_index_at_round, rp2.guest_handicap_index) IS NOT NULL
    AND tb.slope_rating IS NOT NULL
) sub
WHERE rp.id = sub.id;
