export interface RoundStats {
  roundId: string;
  playerId: string;
  totalStrokes: number;
  totalPutts: number | null;
  fairwaysHit: number | null;
  fairwaysPossible: number | null;
  greensInRegulation: number | null;
  greensPossible: number;
  upAndDowns: number | null;
  upAndDownAttempts: number | null;
  scoreToPar: number;
  front9: number;
  back9: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  triplePlusBogeysOrWorse: number;
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
  gir: boolean | null;
  upAndDown: boolean | null;
}
