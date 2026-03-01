import type {
  GameFormatMetadata,
  GameResult,
  PlayerStanding,
  RoundScoreData,
  TeamStanding,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

interface Segment {
  throughHole: number;
  countBest: number;
}

/**
 * Progressive Best Ball — team format where the number of best scores counting
 * increases as the round progresses.
 *
 * Default: 1 ball (holes 1-6), 2 balls (7-11), 3 balls (12-16), 4 balls (17-18).
 * Segments are fully configurable.
 */
export class ProgressiveBestBallEngine extends BaseGameFormatEngine {
  readonly formatId = 'progressive_best_ball' as const;

  private static readonly DEFAULT_SEGMENTS: Segment[] = [
    { throughHole: 6, countBest: 1 },
    { throughHole: 11, countBest: 2 },
    { throughHole: 16, countBest: 3 },
    { throughHole: 18, countBest: 4 },
  ];

  getMetadata(): GameFormatMetadata {
    return {
      id: this.formatId,
      name: 'Progressive Best Ball',
      description:
        'Team format where the number of scores counting increases as the round progresses. Default: 1 ball first 6, 2 balls next 5, 3 balls next 5, 4 balls last 2.',
      category: 'team',
      minPlayers: 4,
      maxPlayers: 32,
      requiresTeams: true,
      handicapAllowance: 0.85,
      defaultConfig: {
        useNet: true,
        segments: ProgressiveBestBallEngine.DEFAULT_SEGMENTS,
      },
      configSchema: [
        {
          key: 'useNet',
          label: 'Use Net Scores',
          type: 'boolean',
          required: false,
          defaultValue: true,
        },
      ],
    };
  }

  validateConfig(config: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const segments = config.segments as Segment[] | undefined;

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      errors.push('At least one segment is required');
      return errors;
    }

    let prevThrough = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (typeof seg.throughHole !== 'number' || seg.throughHole < 1 || seg.throughHole > 18) {
        errors.push(`Segment ${i + 1}: throughHole must be between 1 and 18`);
      }
      if (seg.throughHole <= prevThrough) {
        errors.push(`Segment ${i + 1}: throughHole must be greater than previous segment (${prevThrough})`);
      }
      if (typeof seg.countBest !== 'number' || seg.countBest < 1) {
        errors.push(`Segment ${i + 1}: countBest must be at least 1`);
      }
      prevThrough = seg.throughHole;
    }

    if (segments[segments.length - 1]?.throughHole !== 18) {
      errors.push('Last segment must end at hole 18');
    }

    return errors;
  }

  /**
   * Look up how many best scores count on a given hole number.
   */
  private getCountBest(segments: Segment[], holeNumber: number): number {
    for (const seg of segments) {
      if (holeNumber <= seg.throughHole) return seg.countBest;
    }
    // Fallback: last segment's countBest
    return segments[segments.length - 1]?.countBest ?? 1;
  }

  calculateResults(
    scoreData: RoundScoreData,
    config: Record<string, unknown>,
    gameId: string
  ): GameResult {
    const result = this.emptyResult(gameId);
    const useNet = (config.useNet as boolean) ?? true;
    const segments: Segment[] =
      (config.segments as Segment[]) ?? ProgressiveBestBallEngine.DEFAULT_SEGMENTS;

    if (scoreData.teams.length === 0) {
      result.details = { error: 'Progressive Best Ball requires teams' };
      return result;
    }

    const activeHoles = scoreData.holes.map((h) => h.holeNumber);

    const teamStandings: TeamStanding[] = scoreData.teams.map((team) => {
      let teamTotal = 0;
      let holesCompleted = 0;

      for (const holeNum of activeHoles) {
        const hole = scoreData.holes.find((h) => h.holeNumber === holeNum)!;
        const countBest = this.getCountBest(segments, holeNum);
        const playerNetScores: number[] = [];

        for (const pid of team.playerIds) {
          const score = scoreData.scores.find(
            (s) => s.playerId === pid && s.holeNumber === holeNum
          );
          if (score?.strokes != null) {
            const player = scoreData.players.find((p) => p.playerId === pid);
            const handicap = useNet ? (player?.playingHandicap ?? 0) : 0;
            const net =
              score.strokes -
              this.strokesReceivedOnHole(handicap, hole.handicapIndex);
            playerNetScores.push(net);
          }
        }

        if (playerNetScores.length > 0) {
          playerNetScores.sort((a, b) => a - b);
          const bestScores = playerNetScores.slice(0, countBest);
          teamTotal += bestScores.reduce((sum, s) => sum + s, 0);
          holesCompleted++;
        }
      }

      // Calculate par accounting for varying countBest per hole
      let totalPar = 0;
      for (const hole of scoreData.holes) {
        const countBest = this.getCountBest(segments, hole.holeNumber);
        totalPar += hole.par * countBest;
      }

      return {
        teamId: team.teamId,
        teamName: team.teamName,
        position: 0,
        tied: false,
        totalScore: teamTotal,
        moneyWon: 0,
        metadata: {
          scoreToPar: teamTotal - totalPar,
          holesCompleted,
          segments,
        },
      };
    });

    // Sort and assign positions
    const sorted = [...teamStandings].sort(
      (a, b) => a.totalScore - b.totalScore
    );
    let pos = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].totalScore === sorted[i - 1].totalScore) {
        sorted[i].position = sorted[i - 1].position;
        sorted[i].tied = true;
        sorted[i - 1].tied = true;
      } else {
        sorted[i].position = pos;
      }
      pos++;
    }

    // Individual standings
    const playerStandings: PlayerStanding[] = scoreData.players.map(
      (player) => {
        const holeResults = this.buildHoleResults(
          scoreData.scores,
          scoreData.holes,
          player.playerId,
          useNet ? player.playingHandicap : 0
        );
        return this.createPlayerStanding(player.playerId, holeResults);
      }
    );

    const allComplete = scoreData.teams.every((team) =>
      team.playerIds.every((pid) => {
        const scores = this.getPlayerScores(scoreData.scores, pid, activeHoles);
        return (
          scores.length === activeHoles.length &&
          scores.every((s) => s.strokes !== null)
        );
      })
    );

    result.teamStandings = sorted;
    result.playerStandings = this.sortStandings(
      playerStandings,
      (s) => s.totalNet
    );
    result.isComplete = allComplete;
    result.details = { segments };

    return result;
  }
}
