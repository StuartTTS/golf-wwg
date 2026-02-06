import type {
  GameFormatMetadata,
  GameResult,
  Payout,
  PlayerStanding,
  RoundScoreData,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

export class WolfEngine extends BaseGameFormatEngine {
  readonly formatId = 'wolf' as const;

  getMetadata(): GameFormatMetadata {
    return {
      id: this.formatId,
      name: 'Wolf',
      description:
        'Rotating "wolf" picks a partner after seeing tee shots, or goes alone ("lone wolf"). Best ball of the team vs. the other players.',
      category: 'individual',
      minPlayers: 4,
      maxPlayers: 4,
      requiresTeams: false,
      handicapAllowance: 1.0,
      defaultConfig: {
        useNet: true,
        loneWolfMultiplier: 2,
        pointsPerHole: 1,
      },
      configSchema: [
        {
          key: 'useNet',
          label: 'Use Net Scores',
          type: 'boolean',
          required: false,
          defaultValue: true,
        },
        {
          key: 'loneWolfMultiplier',
          label: 'Lone Wolf Multiplier',
          type: 'number',
          required: false,
          defaultValue: 2,
          min: 1,
          max: 4,
        },
        {
          key: 'pointsPerHole',
          label: 'Points Per Hole',
          type: 'number',
          required: false,
          defaultValue: 1,
          min: 1,
          max: 10,
        },
      ],
    };
  }

  validateConfig(config: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (config.loneWolfMultiplier !== undefined) {
      const val = config.loneWolfMultiplier as number;
      if (typeof val !== 'number' || val < 1 || val > 4) {
        errors.push('loneWolfMultiplier must be between 1 and 4');
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
    const pointsPerHole = (config.pointsPerHole as number) ?? 1;

    if (scoreData.players.length !== 4) {
      result.details = { error: 'Wolf requires exactly 4 players' };
      return result;
    }

    // Wolf rotation: in a 4-player game, wolf rotates 1-2-3-4-1-2-3-4...
    // For automated calculation without real-time wolf picks, we use best ball
    // The wolf game requires real-time decisions; here we calculate based on
    // pre-assigned teams per hole stored in config.wolfSelections
    const wolfSelections = (config.wolfSelections as Record<string, string | 'lone'>) ?? {};
    const activeHoles = scoreData.holes.map((h) => h.holeNumber).sort((a, b) => a - b);

    const points: Record<string, number> = {};
    for (const p of scoreData.players) {
      points[p.playerId] = 0;
    }

    const holeDetails: {
      holeNumber: number;
      wolfId: string;
      partnerId: string | null;
      isLoneWolf: boolean;
      wolfTeamBestBall: number | null;
      otherTeamBestBall: number | null;
      winner: 'wolf' | 'others' | 'tie' | null;
      pointsAwarded: number;
    }[] = [];

    for (let i = 0; i < activeHoles.length; i++) {
      const holeNum = activeHoles[i];
      const hole = scoreData.holes.find((h) => h.holeNumber === holeNum)!;
      const wolfIdx = i % 4;
      const wolf = scoreData.players[wolfIdx];
      const selection = wolfSelections[String(holeNum)];
      const isLoneWolf = selection === 'lone';
      const partnerId = !isLoneWolf ? selection || null : null;

      // Get net scores for all players on this hole
      const holeScores: Record<string, number | null> = {};
      for (const p of scoreData.players) {
        const score = scoreData.scores.find(
          (s) => s.playerId === p.playerId && s.holeNumber === holeNum
        );
        if (score?.strokes == null) {
          holeScores[p.playerId] = null;
        } else {
          const net = useNet
            ? score.strokes - this.strokesReceivedOnHole(p.playingHandicap, hole.handicapIndex)
            : score.strokes;
          holeScores[p.playerId] = net;
        }
      }

      // Check if all scores are entered
      if (Object.values(holeScores).some((s) => s === null)) {
        holeDetails.push({
          holeNumber: holeNum,
          wolfId: wolf.playerId,
          partnerId,
          isLoneWolf,
          wolfTeamBestBall: null,
          otherTeamBestBall: null,
          winner: null,
          pointsAwarded: 0,
        });
        continue;
      }

      // Calculate best ball for wolf team and others
      const wolfTeam = isLoneWolf
        ? [wolf.playerId]
        : [wolf.playerId, partnerId].filter(Boolean) as string[];
      const otherTeam = scoreData.players
        .map((p) => p.playerId)
        .filter((id) => !wolfTeam.includes(id));

      const wolfBest = Math.min(
        ...wolfTeam.map((id) => holeScores[id]!)
      );
      const otherBest = Math.min(
        ...otherTeam.map((id) => holeScores[id]!)
      );

      const multiplier = isLoneWolf
        ? ((config.loneWolfMultiplier as number) ?? 2)
        : 1;
      const holePoints = pointsPerHole * multiplier;

      let winner: 'wolf' | 'others' | 'tie';
      if (wolfBest < otherBest) {
        winner = 'wolf';
        for (const id of wolfTeam) {
          points[id] += holePoints;
        }
      } else if (otherBest < wolfBest) {
        winner = 'others';
        for (const id of otherTeam) {
          points[id] += holePoints;
        }
      } else {
        winner = 'tie';
      }

      holeDetails.push({
        holeNumber: holeNum,
        wolfId: wolf.playerId,
        partnerId,
        isLoneWolf,
        wolfTeamBestBall: wolfBest,
        otherTeamBestBall: otherBest,
        winner,
        pointsAwarded: holePoints,
      });
    }

    const allComplete = scoreData.players.every((player) => {
      const playerScores = this.getPlayerScores(scoreData.scores, player.playerId, activeHoles);
      return (
        playerScores.length === activeHoles.length &&
        playerScores.every((s) => s.strokes !== null)
      );
    });

    // Build standings
    const moneyPerPoint = (config.moneyPerUnit as number) ?? 0;
    const standings: PlayerStanding[] = scoreData.players.map((player) => {
      const holeResults = this.buildHoleResults(
        scoreData.scores,
        scoreData.holes,
        player.playerId,
        useNet ? player.playingHandicap : 0
      );
      const standing = this.createPlayerStanding(player.playerId, holeResults);
      const playerPoints = points[player.playerId] || 0;
      standing.moneyWon = playerPoints * moneyPerPoint;
      standing.metadata = { points: playerPoints };
      return standing;
    });

    result.playerStandings = this.sortStandings(
      standings,
      (s) => (s.metadata.points as number) || 0,
      false
    );
    result.isComplete = allComplete;
    result.details = { holeDetails, points };

    if (moneyPerPoint > 0) {
      result.payouts = standings
        .filter((s) => s.moneyWon > 0)
        .map(
          (s): Payout => ({
            playerId: s.playerId,
            amount: s.moneyWon,
            description: `${s.metadata.points} points @ $${moneyPerPoint}`,
          })
        );
    }

    return result;
  }
}
