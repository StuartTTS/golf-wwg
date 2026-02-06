import type {
  GameFormatId,
  GameFormatMetadata,
  GameResult,
  HoleInfo,
  HoleResult,
  HoleScore,
  IGameFormatEngine,
  PlayerInfo,
  PlayerStanding,
  RoundScoreData,
} from '../types/game-formats';

export abstract class BaseGameFormatEngine implements IGameFormatEngine {
  abstract readonly formatId: GameFormatId;
  abstract getMetadata(): GameFormatMetadata;
  abstract validateConfig(config: Record<string, unknown>): string[];
  abstract calculateResults(
    scoreData: RoundScoreData,
    config: Record<string, unknown>,
    gameId: string
  ): GameResult;

  /**
   * Determine how many strokes a player receives on a given hole.
   * Uses standard golf stroke allocation: if playingHandicap >= holeHandicapIndex, player gets 1 stroke.
   * If playingHandicap >= 18 + holeHandicapIndex, player gets 2 strokes, etc.
   * Negative handicaps give strokes back on hardest holes.
   */
  protected strokesReceivedOnHole(
    playingHandicap: number,
    holeHandicapIndex: number
  ): number {
    if (playingHandicap >= 0) {
      let strokes = Math.floor(playingHandicap / 18);
      const remainder = playingHandicap % 18;
      if (holeHandicapIndex <= remainder) {
        strokes += 1;
      }
      return strokes;
    } else {
      // Negative handicap: player gives strokes back on easiest holes
      const absHandicap = Math.abs(playingHandicap);
      let strokes = -Math.floor(absHandicap / 18);
      const remainder = absHandicap % 18;
      // Give back on highest handicap index holes (easiest)
      if (holeHandicapIndex > 18 - remainder) {
        strokes -= 1;
      }
      return strokes;
    }
  }

  /**
   * Extract a player's scores for specified holes, sorted by hole number.
   */
  protected getPlayerScores(
    scores: HoleScore[],
    playerId: string,
    holes?: number[]
  ): HoleScore[] {
    let filtered = scores.filter((s) => s.playerId === playerId);
    if (holes) {
      filtered = filtered.filter((s) => holes.includes(s.holeNumber));
    }
    return filtered.sort((a, b) => a.holeNumber - b.holeNumber);
  }

  /**
   * Calculate net score for a hole.
   */
  protected calculateNetScore(
    gross: number | null,
    strokesReceived: number
  ): number | null {
    if (gross === null) return null;
    return gross - strokesReceived;
  }

  /**
   * Build hole results for a player across specified holes.
   */
  protected buildHoleResults(
    scores: HoleScore[],
    holes: HoleInfo[],
    playerId: string,
    playingHandicap: number
  ): HoleResult[] {
    return holes.map((hole) => {
      const score = scores.find(
        (s) => s.playerId === playerId && s.holeNumber === hole.holeNumber
      );
      const strokesReceived = this.strokesReceivedOnHole(
        playingHandicap,
        hole.handicapIndex
      );
      const gross = score?.strokes ?? null;
      const net = this.calculateNetScore(gross, strokesReceived);
      const netVsPar = net !== null ? net - hole.par : null;

      let result: string | undefined;
      if (netVsPar !== null) {
        if (netVsPar <= -2) result = 'eagle_or_better';
        else if (netVsPar === -1) result = 'birdie';
        else if (netVsPar === 0) result = 'par';
        else if (netVsPar === 1) result = 'bogey';
        else if (netVsPar === 2) result = 'double_bogey';
        else result = 'triple_plus';
      }

      return {
        holeNumber: hole.holeNumber,
        gross,
        net,
        strokesReceived,
        netVsPar,
        result,
      };
    });
  }

  /**
   * Sort standings by position, handling ties.
   */
  protected sortStandings(
    standings: PlayerStanding[],
    scoreFn: (s: PlayerStanding) => number,
    lowerIsBetter = true
  ): PlayerStanding[] {
    const sorted = [...standings].sort((a, b) => {
      const diff = scoreFn(a) - scoreFn(b);
      return lowerIsBetter ? diff : -diff;
    });

    let position = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && scoreFn(sorted[i]) === scoreFn(sorted[i - 1])) {
        sorted[i].position = sorted[i - 1].position;
        sorted[i].tied = true;
        sorted[i - 1].tied = true;
      } else {
        sorted[i].position = position;
      }
      position++;
    }

    return sorted;
  }

  /**
   * Parse hole range from the holes config string.
   * Supports: 'all', 'front', 'back', '1-9', '10-18', or custom like '1,3,5,7'
   */
  protected parseHoleRange(
    holesConfig: string,
    totalHoles: number
  ): number[] {
    if (holesConfig === 'all') {
      return Array.from({ length: totalHoles }, (_, i) => i + 1);
    }
    if (holesConfig === 'front') {
      const half = Math.ceil(totalHoles / 2);
      return Array.from({ length: half }, (_, i) => i + 1);
    }
    if (holesConfig === 'back') {
      const half = Math.ceil(totalHoles / 2);
      return Array.from({ length: totalHoles - half }, (_, i) => half + i + 1);
    }
    if (holesConfig.includes('-')) {
      const [start, end] = holesConfig.split('-').map(Number);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    // Comma-separated
    return holesConfig.split(',').map(Number);
  }

  /**
   * Create an empty game result structure.
   */
  protected emptyResult(gameId: string): GameResult {
    return {
      gameId,
      format: this.formatId,
      isComplete: false,
      playerStandings: [],
      teamStandings: [],
      payouts: [],
      details: {},
    };
  }

  /**
   * Create a base player standing.
   */
  protected createPlayerStanding(
    playerId: string,
    holeResults: HoleResult[]
  ): PlayerStanding {
    const totalGross = holeResults.reduce(
      (sum, hr) => sum + (hr.gross ?? 0),
      0
    );
    const totalNet = holeResults.reduce((sum, hr) => sum + (hr.net ?? 0), 0);

    return {
      playerId,
      position: 0,
      tied: false,
      totalGross,
      totalNet,
      holeResults,
      moneyWon: 0,
      metadata: {},
    };
  }
}
