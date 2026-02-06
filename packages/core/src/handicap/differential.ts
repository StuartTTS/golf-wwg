/**
 * WHS Score Differential Calculation
 * Formula: (113 / Slope Rating) * (Adjusted Gross Score - Course Rating)
 */
export function calculateScoreDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number
): number {
  if (slopeRating === 0) {
    throw new Error('Slope rating cannot be zero');
  }
  const differential = (113 / slopeRating) * (adjustedGrossScore - courseRating);
  // Round to one decimal place
  return Math.round(differential * 10) / 10;
}

/**
 * Apply Equitable Stroke Control (ESC) to limit maximum hole score.
 * Under WHS, the max score on any hole is Net Double Bogey:
 * Par + 2 + handicap strokes received on the hole
 */
export function applyNetDoubleBogeyAdjustment(
  grossScore: number,
  par: number,
  strokesReceived: number
): number {
  const maxScore = par + 2 + strokesReceived;
  return Math.min(grossScore, maxScore);
}

/**
 * Calculate adjusted gross score for handicap purposes.
 * Applies net double bogey adjustment to each hole.
 */
export function calculateAdjustedGrossScore(
  holeScores: {
    strokes: number;
    par: number;
    strokesReceived: number;
  }[]
): number {
  return holeScores.reduce((total, hole) => {
    const adjusted = applyNetDoubleBogeyAdjustment(
      hole.strokes,
      hole.par,
      hole.strokesReceived
    );
    return total + adjusted;
  }, 0);
}
