/**
 * Playing Handicap Calculation
 * Formula: Course Handicap * Handicap Allowance %
 *
 * Allowance percentages vary by format:
 * - Stroke Play (individual): 95%
 * - Match Play: 100% of difference
 * - Four-Ball Stroke Play: 85%
 * - Four-Ball Match Play: 90%
 * - Foursomes (Alternate Shot): 50% of combined
 * - Scramble: varies (25% low + 10% high typically)
 */
export function calculatePlayingHandicap(
  courseHandicap: number,
  allowancePercent: number
): number {
  return Math.round(courseHandicap * allowancePercent);
}

/**
 * For match play, calculate the strokes given based on the difference
 * between the two players' course handicaps.
 */
export function calculateMatchPlayStrokes(
  player1CourseHandicap: number,
  player2CourseHandicap: number,
  allowancePercent: number = 1.0
): { player1Strokes: number; player2Strokes: number } {
  const diff = Math.abs(player1CourseHandicap - player2CourseHandicap);
  const adjustedDiff = Math.round(diff * allowancePercent);

  if (player1CourseHandicap > player2CourseHandicap) {
    return { player1Strokes: adjustedDiff, player2Strokes: 0 };
  } else if (player2CourseHandicap > player1CourseHandicap) {
    return { player1Strokes: 0, player2Strokes: adjustedDiff };
  }
  return { player1Strokes: 0, player2Strokes: 0 };
}
