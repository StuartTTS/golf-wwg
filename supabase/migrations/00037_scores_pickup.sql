-- ============================================================
-- SCORES: pickup / "X"  (Phase 2 — best-ball support)
-- ============================================================
-- In best ball a player who's out of a hole picks up ("X"). That hole still
-- needs to be RECORDED so the round can be considered complete, but it carries
-- no stroke value. Add a boolean marker distinct from "not entered yet".
--
-- "Recorded" therefore means: strokes IS NOT NULL OR pickup. A pickup never
-- carries a stroke value (enforced below). No RLS change — the existing
-- score-write / card-lock policies (00024) apply to this column unchanged.
-- `scores` is already published to realtime, so `pickup` rides along.
-- ============================================================

ALTER TABLE scores ADD COLUMN pickup BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE scores ADD CONSTRAINT scores_pickup_no_strokes
  CHECK (NOT pickup OR strokes IS NULL);
