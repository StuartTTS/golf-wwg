# Editing a round's course & tees (any time)

A round's course, default tee, and per-player tees are editable by the Commish
**from the round page, even after the round has started** — a fix for "I picked
the wrong course and couldn't change it."

## Where
- **Round page → "Course & Tees" card** (Commish/admin only): change the course
  and default tee.
- **Round page → "Tee Assignments" card**: default tee + per-player tees.
- Both are reachable mid-round: the Play view's ✕ returns to the round page.
- Editing is allowed while `upcoming` or `in_progress`; a `completed` round must
  be reopened first (it's been posted to stats).

## What changing the course does (`updateRoundCourse`)
Tee boxes belong to a course, so a course change can't keep the old tee ids:

1. `rounds.course_id` + `rounds.tee_box_id` → the new course + chosen default tee.
2. **Every** `round_players.tee_box_id` moves to the new default tee, and
   `course_handicap` / `playing_handicap` re-rate from the new slope.
3. Per-player tees can then be fine-tuned in Tee Assignments.

Flights (tee-time groups) and games are player-keyed, so they're untouched.

## Scores
Scores are keyed by hole number, so they're **kept** across a course change but
are graded against the new course's pars. The card warns when scores already
exist. No score rows are deleted.

## Authorization
`updateRoundCourse` allows the round **creator (Commish)** or a **group admin**;
RLS on `rounds` / `round_players` is the backstop (mirrors the tee-assignment
actions).
