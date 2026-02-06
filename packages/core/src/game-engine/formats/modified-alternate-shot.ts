import type {
  GameFormatMetadata,
  GameResult,
  RoundScoreData,
  TeamStanding,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

export class ModifiedAlternateShotEngine extends BaseGameFormatEngine {
  readonly formatId = 'modified_alternate_shot' as const;

  getMetadata(): GameFormatMetadata {
    return {
      id: this.formatId,
      name: 'Modified Alternate Shot (Greensomes)',
      description:
        'Both players tee off, select the best drive, then alternate shots from there.',
      category: 'team',
      minPlayers: 4,
      maxPlayers: 20,
      requiresTeams: true,
      handicapAllowance: 0.6,
      defaultConfig: { useNet: true },
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

  validateConfig(_config: Record<string, unknown>): string[] {
    return [];
  }

  calculateResults(
    scoreData: RoundScoreData,
    config: Record<string, unknown>,
    gameId: string
  ): GameResult {
    const result = this.emptyResult(gameId);
    const useNet = (config.useNet as boolean) ?? true;

    if (scoreData.teams.length === 0) {
      result.details = { error: 'Modified alternate shot requires teams' };
      return result;
    }

    const activeHoles = scoreData.holes.map((h) => h.holeNumber);

    const teamStandings: TeamStanding[] = scoreData.teams.map((team) => {
      const representative = team.playerIds[0];
      const teamScores = this.getPlayerScores(scoreData.scores, representative, activeHoles);

      // Greensomes handicap: 60% of low + 40% of high
      let teamHandicap = 0;
      if (useNet && team.playerIds.length >= 2) {
        const handicaps = team.playerIds
          .map((id) => scoreData.players.find((p) => p.playerId === id)?.playingHandicap ?? 0)
          .sort((a, b) => a - b);
        teamHandicap = Math.round(handicaps[0] * 0.6 + handicaps[1] * 0.4);
      }

      let totalNet = 0;
      for (const holeNum of activeHoles) {
        const hole = scoreData.holes.find((h) => h.holeNumber === holeNum)!;
        const score = teamScores.find((s) => s.holeNumber === holeNum);
        if (score?.strokes != null) {
          const strokesReceived = this.strokesReceivedOnHole(teamHandicap, hole.handicapIndex);
          totalNet += score.strokes - strokesReceived;
        }
      }

      const totalGross = teamScores.reduce((sum, s) => sum + (s.strokes ?? 0), 0);

      return {
        teamId: team.teamId,
        teamName: team.teamName,
        position: 0,
        tied: false,
        totalScore: useNet ? totalNet : totalGross,
        moneyWon: 0,
        metadata: { totalGross, totalNet, teamHandicap },
      };
    });

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
    result.isComplete = true;
    return result;
  }
}
