/**
 * Course Handicap Calculation
 * Formula: Handicap Index * (Slope Rating / 113)
 * Result is rounded to nearest whole number.
 */
export function calculateCourseHandicap(
  handicapIndex: number,
  slopeRating: number
): number {
  const courseHandicap = handicapIndex * (slopeRating / 113);
  return Math.round(courseHandicap);
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
