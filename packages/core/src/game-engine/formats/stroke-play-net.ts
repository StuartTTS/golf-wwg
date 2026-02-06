import type {
  GameFormatMetadata,
  GameResult,
  RoundScoreData,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

export class StrokePlayNetEngine extends BaseGameFormatEngine {
  readonly formatId = 'stroke_play_net' as const;

  getMetadata(): GameFormatMetadata {
    return {
      id: this.formatId,
      name: 'Stroke Play (Net)',
      description: 'Stroke play using net scores after handicap strokes. Lowest net total wins.',
      category: 'individual',
      minPlayers: 2,
      maxPlayers: 30,
      requiresTeams: false,
      handicapAllowance: 1.0,
      defaultConfig: {},
      configSchema: [],
    };
  }

  validateConfig(_config: Record<string, unknown>): string[] {
    return [];
  }

  calculateResults(
    scoreData: RoundScoreData,
    _config: Record<string, unknown>,
    gameId: string
  ): GameResult {
    const result = this.emptyResult(gameId);
    const activeHoles = scoreData.holes.map((h) => h.holeNumber);
    const allHolesComplete = scoreData.players.every((player) => {
      const playerScores = this.getPlayerScores(scoreData.scores, player.playerId, activeHoles);
      return playerScores.length === activeHoles.length && playerScores.every((s) => s.strokes !== null);
    });

    const standings = scoreData.players.map((player) => {
      const holeResults = this.buildHoleResults(
        scoreData.scores,
        scoreData.holes,
        player.playerId,
        player.playingHandicap
      );
      return this.createPlayerStanding(player.playerId, holeResults);
    });

    result.playerStandings = this.sortStandings(standings, (s) => s.totalNet);
    result.isComplete = allHolesComplete;

    return result;
  }
}
