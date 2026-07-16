import type { HoleStatInput, RoundStats, PlayerStatsSummary } from '../types/stats';

/**
 * Calculate stats for a single round.
 */
export function calculateRoundStats(
  roundId: string,
  playerId: string,
  holes: HoleStatInput[],
  coursePar: number
): RoundStats {
  const completed = holes.filter((h) => h.strokes !== null);
  const totalStrokes = completed.reduce((sum, h) => sum + h.strokes!, 0);
  const hasPutts = holes.some((h) => h.putts !== null);
  const totalPutts = hasPutts
    ? completed.reduce((sum, h) => sum + (h.putts ?? 0), 0)
    : null;
  const threePutts = hasPutts
    ? completed.filter((h) => (h.putts ?? 0) >= 3).length
    : null;

  // Fairways (only par 4 and par 5 holes have fairways)
  const fairwayHoles = completed.filter((h) => h.par >= 4 && h.fairwayHit !== null);
  const fairwaysHit = fairwayHoles.filter((h) => h.fairwayHit).length;
  const fairwaysPossible = fairwayHoles.length;
  const fairwayMiss = {
    left: fairwayHoles.filter((h) => h.fairwayMiss === 'left').length,
    right: fairwayHoles.filter((h) => h.fairwayMiss === 'right').length,
  };

  // GIR
  const girHoles = completed.filter((h) => h.gir !== null);
  const greensInRegulation = girHoles.filter((h) => h.gir).length;
  const greensPossible = completed.length;
  const greenMiss = {
    short: completed.filter((h) => h.greenMiss === 'short').length,
    long: completed.filter((h) => h.greenMiss === 'long').length,
    left: completed.filter((h) => h.greenMiss === 'left').length,
    right: completed.filter((h) => h.greenMiss === 'right').length,
  };

  // Up and down (scramble)
  const upDownHoles = completed.filter((h) => h.upAndDown !== null);
  const upAndDowns = upDownHoles.filter((h) => h.upAndDown).length;
  const upAndDownAttempts = upDownHoles.length;

  // Sand saves — up-and-down from a greenside bunker (par or better after being in sand)
  const sandHoles = completed.filter(
    (h) => h.greensideBunker === true && h.upAndDown !== null
  );
  const sandSaves = sandHoles.filter((h) => h.upAndDown).length;
  const sandSaveAttempts = sandHoles.length;

  // Penalties
  const hasPenalties = holes.some((h) => h.penalties !== null);
  const penalties = hasPenalties
    ? completed.reduce((sum, h) => sum + (h.penalties ?? 0), 0)
    : null;

  // Scoring distribution
  let eagles = 0,
    birdies = 0,
    pars = 0,
    bogeys = 0,
    doubleBogeys = 0,
    triplePlusBogeysOrWorse = 0;

  for (const hole of completed) {
    const scoreToPar = hole.strokes! - hole.par;
    if (scoreToPar <= -2) eagles++;
    else if (scoreToPar === -1) birdies++;
    else if (scoreToPar === 0) pars++;
    else if (scoreToPar === 1) bogeys++;
    else if (scoreToPar === 2) doubleBogeys++;
    else triplePlusBogeysOrWorse++;
  }

  // Front/back split
  const front9 = completed
    .filter((h) => h.holeNumber <= 9)
    .reduce((sum, h) => sum + h.strokes!, 0);
  const back9 = completed
    .filter((h) => h.holeNumber > 9)
    .reduce((sum, h) => sum + h.strokes!, 0);

  return {
    roundId,
    playerId,
    totalStrokes,
    totalPutts,
    threePutts,
    fairwaysHit: fairwaysPossible > 0 ? fairwaysHit : null,
    fairwaysPossible: fairwaysPossible > 0 ? fairwaysPossible : null,
    greensInRegulation: girHoles.length > 0 ? greensInRegulation : null,
    greensPossible,
    upAndDowns: upAndDownAttempts > 0 ? upAndDowns : null,
    upAndDownAttempts: upAndDownAttempts > 0 ? upAndDownAttempts : null,
    sandSaves: sandSaveAttempts > 0 ? sandSaves : null,
    sandSaveAttempts: sandSaveAttempts > 0 ? sandSaveAttempts : null,
    penalties,
    scoreToPar: totalStrokes - coursePar,
    front9,
    back9,
    eagles,
    birdies,
    pars,
    bogeys,
    doubleBogeys,
    triplePlusBogeysOrWorse,
    fairwayMiss,
    greenMiss,
  };
}

/**
 * Calculate summary stats across multiple rounds.
 */
export function calculatePlayerStatsSummary(
  playerId: string,
  roundStats: RoundStats[],
  parByType?: { par3: number[]; par4: number[]; par5: number[] }
): PlayerStatsSummary {
  const n = roundStats.length;
  if (n === 0) {
    return {
      playerId,
      roundsPlayed: 0,
      averageScore: 0,
      bestScore: 0,
      worstScore: 0,
      averagePutts: null,
      fairwayHitPercentage: null,
      girPercentage: null,
      scramblePercentage: null,
      averageScoreToPar: 0,
      scoringByPar: { par3Average: 0, par4Average: 0, par5Average: 0 },
      recentTrend: [],
    };
  }

  const scores = roundStats.map((r) => r.totalStrokes);
  const averageScore = scores.reduce((a, b) => a + b, 0) / n;
  const bestScore = Math.min(...scores);
  const worstScore = Math.max(...scores);

  // Putts
  const puttRounds = roundStats.filter((r) => r.totalPutts !== null);
  const averagePutts =
    puttRounds.length > 0
      ? puttRounds.reduce((sum, r) => sum + r.totalPutts!, 0) / puttRounds.length
      : null;

  // FIR%
  const firRounds = roundStats.filter((r) => r.fairwaysHit !== null);
  const fairwayHitPercentage =
    firRounds.length > 0
      ? (firRounds.reduce((sum, r) => sum + r.fairwaysHit!, 0) /
          firRounds.reduce((sum, r) => sum + r.fairwaysPossible!, 0)) *
        100
      : null;

  // GIR%
  const girRounds = roundStats.filter((r) => r.greensInRegulation !== null);
  const girPercentage =
    girRounds.length > 0
      ? (girRounds.reduce((sum, r) => sum + r.greensInRegulation!, 0) /
          girRounds.reduce((sum, r) => sum + r.greensPossible, 0)) *
        100
      : null;

  // Scramble%
  const scrambleRounds = roundStats.filter((r) => r.upAndDowns !== null);
  const scramblePercentage =
    scrambleRounds.length > 0
      ? (scrambleRounds.reduce((sum, r) => sum + r.upAndDowns!, 0) /
          scrambleRounds.reduce((sum, r) => sum + r.upAndDownAttempts!, 0)) *
        100
      : null;

  const averageScoreToPar =
    roundStats.reduce((sum, r) => sum + r.scoreToPar, 0) / n;

  return {
    playerId,
    roundsPlayed: n,
    averageScore: Math.round(averageScore * 10) / 10,
    bestScore,
    worstScore,
    averagePutts: averagePutts !== null ? Math.round(averagePutts * 10) / 10 : null,
    fairwayHitPercentage:
      fairwayHitPercentage !== null
        ? Math.round(fairwayHitPercentage * 10) / 10
        : null,
    girPercentage:
      girPercentage !== null ? Math.round(girPercentage * 10) / 10 : null,
    scramblePercentage:
      scramblePercentage !== null
        ? Math.round(scramblePercentage * 10) / 10
        : null,
    averageScoreToPar: Math.round(averageScoreToPar * 10) / 10,
    scoringByPar: { par3Average: 0, par4Average: 0, par5Average: 0 }, // TODO: needs hole-level data
    recentTrend: roundStats.slice(-10).map((r) => r.totalStrokes),
  };
}
