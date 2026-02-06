import type {
  GameFormatMetadata,
  GameResult,
  RoundScoreData,
  TeamStanding,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

export class ShambleEngine extends BaseGameFormatEngine {
  readonly formatId = 'shamble' as const;

  getMetadata(): GameFormatMetadata {
    return {
      id: this.formatId,
      name: 'Shamble',
      description:
        'Team format: all players tee off, best drive is selected, then each player plays their own ball from there. Best 1 or 2 scores count.',
      category: 'team',
      minPlayers: 4,
      maxPlayers: 20,
      requiresTeams: true,
      handicapAllowance: 0.8,
      defaultConfig: { countBest: 1, useNet: true },
      configSchema: [
        {
          key: 'countBest',
          label: 'Best Scores to Count',
          type: 'number',
          required: false,
          defaultValue: 1,
          min: 1,
          max: 4,
        },
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
    if (config.countBest !== undefined) {
      const val = config.countBest as number;
      if (typeof val !== 'number' || val < 1 || val > 4) {
        errors.push('countBest must be between 1 and 4');
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
    const countBest = (config.countBest as number) ?? 1;
    const useNet = (config.useNet as boolean) ?? true;

    if (scoreData.teams.length === 0) {
      result.details = { error: 'Shamble requires teams' };
      return result;
    }

    const activeHoles = scoreData.holes.map((h) => h.holeNumber);

    const teamStandings: TeamStanding[] = scoreData.teams.map((team) => {
      let teamTotal = 0;

      for (const holeNum of activeHoles) {
        const hole = scoreData.holes.find((h) => h.holeNumber === holeNum)!;
        const playerScores: number[] = [];

        for (const pid of team.playerIds) {
          const score = scoreData.scores.find(
            (s) => s.playerId === pid && s.holeNumber === holeNum
          );
          if (score?.strokes != null) {
            const player = scoreData.players.find((p) => p.playerId === pid);
            const handicap = useNet ? (player?.playingHandicap ?? 0) : 0;
            const net = score.strokes - this.strokesReceivedOnHole(handicap, hole.handicapIndex);
            playerScores.push(net);
          }
        }

        // Take best N scores
        playerScores.sort((a, b) => a - b);
        const bestScores = playerScores.slice(0, countBest);
        teamTotal += bestScores.reduce((sum, s) => sum + s, 0);
      }

      return {
        teamId: team.teamId,
        teamName: team.teamName,
        position: 0,
        tied: false,
        totalScore: teamTotal,
        moneyWon: 0,
        metadata: { countBest },
      };
    });

    // Sort and assign positions
    const sorted = [...teamStandings].sort((a, b) => a.totalScore - b.totalScore);
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

    result.teamStandings = sorted;
    result.isComplete = true; // Simplified; check all team members' scores
    result.details = { countBest };

    return result;
  }
}
