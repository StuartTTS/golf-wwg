/**
 * Course Handicap Calculation (WHS)
 * Formula: Handicap Index * (Slope Rating / 113) + (Course Rating - Par)
 *
 * When `courseRating` and `par` are supplied, the full WHS formula is used
 * (matches Golf Genius and any WHS-compliant scorer). When they're omitted we
 * fall back to the slope-only term — but note the DB trigger
 * `set_round_player_course_handicap` is the source of truth for stored values,
 * so this is only the optimistic/client number.
 */
export function calculateCourseHandicap(
  handicapIndex: number,
  slopeRating: number,
  courseRating?: number | null,
  par?: number | null
): number {
  const ratingTerm =
    courseRating != null && par != null ? courseRating - par : 0;
  return Math.round(handicapIndex * (slopeRating / 113) + ratingTerm);
}

/**
 * Full course handicap with course rating differential.
 * Formula: Handicap Index * (Slope / 113) + (Course Rating - Par)
 * This is the more complete WHS formula used for different tee calculations.
 */
export function calculateCourseHandicapFull(
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number
): number {
  const courseHandicap =
    handicapIndex * (slopeRating / 113) + (courseRating - par);
  return Math.round(courseHandicap);
}
