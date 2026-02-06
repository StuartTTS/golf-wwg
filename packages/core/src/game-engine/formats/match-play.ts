import type {
  GameFormatMetadata,
  GameResult,
  PlayerStanding,
  RoundScoreData,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

export class MatchPlayEngine extends BaseGameFormatEngine {
  readonly formatId = 'match_play' as const;

  getMetadata(): GameFormatMetadata {
    return {
      id: this.formatId,
      name: 'Match Play',
      description:
        'Head-to-head format where each hole is a separate contest. Win, lose, or halve each hole.',
      category: 'match',
      minPlayers: 2,
      maxPlayers: 2,
      requiresTeams: false,
      handicapAllowance: 1.0,
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

    if (scoreData.players.length !== 2) {
      result.details = { error: 'Match play requires exactly 2 players' };
      return result;
    }

    const [p1, p2] = scoreData.players;
    const activeHoles = scoreData.holes.map((h) => h.holeNumber).sort((a, b) => a - b);

    let p1Up = 0; // positive = p1 is up, negative = p2 is up
    const holeDetails: {
      holeNumber: number;
      p1Net: number | null;
      p2Net: number | null;
      winner: string | null;
      matchStatus: string;
    }[] = [];

    let matchConcluded = false;
    let completedHoles = 0;

    for (const holeNum of activeHoles) {
      if (matchConcluded) break;

      const hole = scoreData.holes.find((h) => h.holeNumber === holeNum)!;
      const s1 = scoreData.scores.find(
        (s) => s.playerId === p1.playerId && s.holeNumber === holeNum
      );
      const s2 = scoreData.scores.find(
        (s) => s.playerId === p2.playerId && s.holeNumber === holeNum
      );

      if (s1?.strokes == null || s2?.strokes == null) break;

      completedHoles++;
      let p1Score = s1.strokes;
      let p2Score = s2.strokes;

      if (useNet) {
        p1Score -= this.strokesReceivedOnHole(p1.playingHandicap, hole.handicapIndex);
        p2Score -= this.strokesReceivedOnHole(p2.playingHandicap, hole.handicapIndex);
      }

      let winner: string | null = null;
      if (p1Score < p2Score) {
        p1Up++;
        winner = p1.playerId;
      } else if (p2Score < p1Score) {
        p1Up--;
        winner = p2.playerId;
      }

      const holesRemaining = activeHoles.length - completedHoles;
      const lead = Math.abs(p1Up);

      let matchStatus: string;
      if (lead > holesRemaining && holesRemaining >= 0) {
        // Match is decided
        matchStatus = `${lead} & ${holesRemaining}`;
        matchConcluded = true;
      } else if (p1Up > 0) {
        matchStatus = `${p1.playerId} ${lead} UP`;
      } else if (p1Up < 0) {
        matchStatus = `${p2.playerId} ${lead} UP`;
      } else {
        matchStatus = 'All Square';
      }

      holeDetails.push({
        holeNumber: holeNum,
        p1Net: p1Score,
        p2Net: p2Score,
        winner,
        matchStatus,
      });
    }

    const allComplete = completedHoles === activeHoles.length || matchConcluded;

    // Build standings
    const buildStanding = (player: typeof p1, isP1: boolean): PlayerStanding => {
      const holeResults = this.buildHoleResults(
        scoreData.scores,
        scoreData.holes,
        player.playerId,
        useNet ? player.playingHandicap : 0
      );
      const standing = this.createPlayerStanding(player.playerId, holeResults);
      const holesUp = isP1 ? p1Up : -p1Up;
      standing.metadata = {
        holesUp,
        holesWon: holeDetails.filter((d) => d.winner === player.playerId).length,
        holesLost: holeDetails.filter(
          (d) => d.winner !== null && d.winner !== player.playerId
        ).length,
        holesHalved: holeDetails.filter((d) => d.winner === null).length,
        matchResult: holesUp > 0 ? 'winning' : holesUp < 0 ? 'losing' : 'tied',
      };
      return standing;
    };

    const standings = [
      buildStanding(p1, true),
      buildStanding(p2, false),
    ];

    // Winner gets position 1
    if (p1Up > 0) {
      standings[0].position = 1;
      standings[1].position = 2;
    } else if (p1Up < 0) {
      standings[0].position = 2;
      standings[1].position = 1;
    } else {
      standings[0].position = 1;
      standings[0].tied = true;
      standings[1].position = 1;
      standings[1].tied = true;
    }

    result.playerStandings = standings;
    result.isComplete = allComplete;
    result.details = { holeDetails, matchConcluded, currentStatus: p1Up };

    return result;
  }
}
