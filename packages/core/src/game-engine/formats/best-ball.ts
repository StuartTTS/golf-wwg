import type {
  GameFormatId,
  GameFormatMetadata,
  GameResult,
  PlayerStanding,
  RoundScoreData,
  TeamStanding,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

/**
 * Shared implementation for Best Ball (2, 3, or 4 players per team).
 * Each player plays their own ball; lowest net score on each hole counts for the team.
 */
function createBestBallEngine(
  teamSize: 2 | 3 | 4,
  formatId: GameFormatId,
  name: string
) {
  return class BestBallEngine extends BaseGameFormatEngine {
    readonly formatId = formatId;

    getMetadata(): GameFormatMetadata {
      return {
        id: this.formatId,
        name,
        description: `Team format with ${teamSize} players per team. Each player plays their own ball; the lowest net score on each hole counts for the team.`,
        category: 'team',
        minPlayers: teamSize * 2,
        maxPlayers: teamSize * 8,
        requiresTeams: true,
        handicapAllowance: teamSize === 2 ? 0.9 : teamSize === 3 ? 0.85 : 0.8,
        defaultConfig: { useNet: true, countBest: 1 },
        configSchema: [
          {
            key: 'useNet',
            label: 'Use Net Scores',
            type: 'boolean',
            required: false,
            defaultValue: true,
          },
          {
            key: 'countBest',
            label: 'Best Scores to Count',
            type: 'number',
            required: false,
            defaultValue: 1,
            min: 1,
            max: teamSize,
          },
        ],
      };
    }

    validateConfig(config: Record<string, unknown>): string[] {
      const errors: string[] = [];
      if (config.countBest !== undefined) {
        const val = config.countBest as number;
        if (typeof val !== 'number' || val < 1 || val > teamSize) {
          errors.push(`countBest must be between 1 and ${teamSize}`);
        }
      }
      return errors;
    }

    calculateResults(
      scoreData: RoundScoreData,
      config: Record<string, unknown>,
      gameId: string
    ): GameResult {
      const result = this.emptyResult(gameId);
      const useNet = (config.useNet as boolean) ?? true;
      const countBest = (config.countBest as number) ?? 1;

      if (scoreData.teams.length === 0) {
        result.details = { error: 'Best ball requires teams' };
        return result;
      }

      const activeHoles = scoreData.holes.map((h) => h.holeNumber);

      const teamStandings: TeamStanding[] = scoreData.teams.map((team) => {
        let teamTotal = 0;
        let holesCompleted = 0;

        for (const holeNum of activeHoles) {
          const hole = scoreData.holes.find((h) => h.holeNumber === holeNum)!;
          const playerNetScores: number[] = [];

          for (const pid of team.playerIds) {
            const score = scoreData.scores.find(
              (s) => s.playerId === pid && s.holeNumber === holeNum
            );
            if (score?.strokes != null) {
              const player = scoreData.players.find(
                (p) => p.playerId === pid
              );
              const handicap = useNet
                ? (player?.playingHandicap ?? 0)
                : 0;
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

        const totalPar = scoreData.holes.reduce((sum, h) => sum + h.par, 0) * countBest;

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
            countBest,
          },
        };
      });

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
      result.details = { countBest };

      return result;
    }
  };
}

export const BestBall2Engine = createBestBallEngine(
  2,
  'best_ball_2',
  'Best Ball (2-Player Teams)'
);

export const BestBall3Engine = createBestBallEngine(
  3,
  'best_ball_3',
  'Best Ball (3-Player Teams)'
);

export const BestBall4Engine = createBestBallEngine(
  4,
  'best_ball_4',
  'Best Ball (4-Player Teams)'
);
