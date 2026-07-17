export interface RoundStats {
  roundId: string;
  playerId: string;
  totalStrokes: number;
  totalPutts: number | null;
  threePutts: number | null;
  fairwaysHit: number | null;
  fairwaysPossible: number | null;
  greensInRegulation: number | null;
  greensPossible: number;
  upAndDowns: number | null;
  upAndDownAttempts: number | null;
  sandSaves: number | null;
  sandSaveAttempts: number | null;
  penalties: number | null;
  scoreToPar: number;
  front9: number;
  back9: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  triplePlusBogeysOrWorse: number;
  /** Miss patterns — feed the Claude drill recommender. */
  fairwayMiss: { left: number; right: number };
  greenMiss: { short: number; long: number; left: number; right: number };
}

export interface PlayerStatsSummary {
  playerId: string;
  roundsPlayed: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  averagePutts: number | null;
  fairwayHitPercentage: number | null;
  girPercentage: number | null;
  scramblePercentage: number | null;
  averageScoreToPar: number;
  scoringByPar: {
    par3Average: number;
    par4Average: number;
    par5Average: number;
  };
  recentTrend: number[]; // last N scores
}

export interface HoleStatInput {
  holeNumber: number;
  par: number;
  strokes: number | null;
  putts: number | null;
  fairwayHit: boolean | null;
  fairwayMiss: 'left' | 'right' | null;
  gir: boolean | null;
  greenMiss: 'short' | 'long' | 'left' | 'right' | null;
  fairwayBunker: boolean | null;
  greensideBunker: boolean | null;
  penalties: number | null;
  upAndDown: boolean | null;
}
