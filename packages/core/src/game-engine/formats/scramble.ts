import type {
  GameFormatMetadata,
  GameResult,
  PlayerStanding,
  RoundScoreData,
  TeamStanding,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

export class ScrambleEngine extends BaseGameFormatEngine {
  readonly formatId = 'scramble' as const;

  getMetadata(): GameFormatMetadata {
    return {
      id: this.formatId,
      name: 'Scramble',
      description:
        'Team format where all players hit, best shot is selected, and all play from there. Repeat until holed out.',
      category: 'team',
      minPlayers: 4,
      maxPlayers: 20,
      requiresTeams: true,
      handicapAllowance: 0.25, // Typical scramble: 25% of low + 10% of high
      defaultConfig: { lowHandicapPercent: 0.25, highHandicapPercent: 0.1 },
      configSchema: [
        {
          key: 'lowHandicapPercent',
          label: 'Low Handicap %',
          type: 'number',
          required: false,
          defaultValue: 0.25,
          min: 0,
          max: 1,
        },
        {
          key: 'highHandicapPercent',
          label: 'High Handicap %',
          type: 'number',
          required: false,
          defaultValue: 0.1,
          min: 0,
          max: 1,
        },
      ],
    };
  }

  validateConfig(config: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (config.lowHandicapPercent !== undefined) {
      const val = config.lowHandicapPercent as number;
      if (typeof val !== 'number' || val < 0 || val > 1) {
        errors.push('lowHandicapPercent must be between 0 and 1');
      }
    }
    return errors;
  }

  calculateResults(
    scoreData: RoundScoreData,
    _config: Record<string, unknown>,
    gameId: string
  ): GameResult {
    const result = this.emptyResult(gameId);

    if (scoreData.teams.length === 0) {
      result.details = { error: 'Scramble requires teams' };
      return result;
    }

    const activeHoles = scoreData.holes.map((h) => h.holeNumber);

    // In scramble, team score is entered once (typically under one player's name per team).
    // We take the first player in each team as the score representative.
    const teamStandings: TeamStanding[] = scoreData.teams.map((team) => {
      const representativePlayer = team.playerIds[0];
      const teamScores = this.getPlayerScores(
        scoreData.scores,
        representativePlayer,
        activeHoles
      );
      const totalScore = teamScores.reduce(
        (sum, s) => sum + (s.strokes ?? 0),
        0
      );
      const totalPar = scoreData.holes.reduce((sum, h) => sum + h.par, 0);

      return {
        teamId: team.teamId,
        teamName: team.teamName,
        position: 0,
        tied: false,
        totalScore,
        moneyWon: 0,
        metadata: {
          scoreToPar: totalScore - totalPar,
          holesCompleted: teamScores.filter((s) => s.strokes !== null).length,
        },
      };
    });

    // Sort teams
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

    // Also build individual standings (same score for all team members)
    const playerStandings: PlayerStanding[] = scoreData.players.map(
      (player) => {
        const holeResults = this.buildHoleResults(
          scoreData.scores,
          scoreData.holes,
          player.playerId,
          0
        );
        return this.createPlayerStanding(player.playerId, holeResults);
      }
    );

    const allComplete = scoreData.teams.every((team) => {
      const rep = team.playerIds[0];
      const scores = this.getPlayerScores(scoreData.scores, rep, activeHoles);
      return (
        scores.length === activeHoles.length &&
        scores.every((s) => s.strokes !== null)
      );
    });

    result.teamStandings = sorted;
    result.playerStandings = playerStandings;
    result.isComplete = allComplete;

    return result;
  }
}
