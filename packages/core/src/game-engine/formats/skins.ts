import type {
  GameFormatMetadata,
  GameResult,
  Payout,
  PlayerStanding,
  RoundScoreData,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

export class SkinsEngine extends BaseGameFormatEngine {
  readonly formatId = 'skins' as const;

  getMetadata(): GameFormatMetadata {
    return {
      id: this.formatId,
      name: 'Skins',
      description:
        'Each hole is worth one "skin." Lowest score wins the hole. Ties carry over to the next hole.',
      category: 'individual',
      minPlayers: 2,
      maxPlayers: 8,
      requiresTeams: false,
      handicapAllowance: 1.0,
      defaultConfig: { useNet: true, carryOver: true },
      configSchema: [
        {
          key: 'useNet',
          label: 'Use Net Scores',
          type: 'boolean',
          required: false,
          defaultValue: true,
        },
        {
          key: 'carryOver',
          label: 'Carry Over Ties',
          type: 'boolean',
          required: false,
          defaultValue: true,
        },
      ],
    };
  }

  validateConfig(config: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (config.useNet !== undefined && typeof config.useNet !== 'boolean') {
      errors.push('useNet must be a boolean');
    }
    if (config.carryOver !== undefined && typeof config.carryOver !== 'boolean') {
      errors.push('carryOver must be a boolean');
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
    const carryOver = (config.carryOver as boolean) ?? true;
    const moneyPerSkin = (config.moneyPerUnit as number) ?? 0;

    const activeHoles = scoreData.holes
      .map((h) => h.holeNumber)
      .sort((a, b) => a - b);

    // Track skins won per player
    const skinsWon: Record<string, number[]> = {};
    for (const player of scoreData.players) {
      skinsWon[player.playerId] = [];
    }

    let pot = 1; // Number of skins on current hole
    const skinDetails: {
      holeNumber: number;
      winnerId: string | null;
      skinsValue: number;
      scores: Record<string, number | null>;
    }[] = [];

    for (const holeNum of activeHoles) {
      const hole = scoreData.holes.find((h) => h.holeNumber === holeNum)!;
      const holeScores: { playerId: string; score: number }[] = [];

      for (const player of scoreData.players) {
        const scoreEntry = scoreData.scores.find(
          (s) => s.playerId === player.playerId && s.holeNumber === holeNum
        );
        if (scoreEntry?.strokes === null || scoreEntry?.strokes === undefined) {
          // Incomplete hole - can't determine winner
          skinDetails.push({
            holeNumber: holeNum,
            winnerId: null,
            skinsValue: pot,
            scores: Object.fromEntries(
              scoreData.players.map((p) => {
                const s = scoreData.scores.find(
                  (sc) => sc.playerId === p.playerId && sc.holeNumber === holeNum
                );
                return [p.playerId, s?.strokes ?? null];
              })
            ),
          });
          if (carryOver) pot++;
          continue;
        }

        let score = scoreEntry.strokes;
        if (useNet) {
          const strokesReceived = this.strokesReceivedOnHole(
            player.playingHandicap,
            hole.handicapIndex
          );
          score = score - strokesReceived;
        }
        holeScores.push({ playerId: player.playerId, score });
      }

      if (holeScores.length < scoreData.players.length) continue;

      // Find lowest score
      const minScore = Math.min(...holeScores.map((s) => s.score));
      const winners = holeScores.filter((s) => s.score === minScore);

      const scoresMap = Object.fromEntries(
        holeScores.map((hs) => [hs.playerId, hs.score])
      );

      if (winners.length === 1) {
        // One winner - takes the pot
        skinsWon[winners[0].playerId].push(holeNum);
        skinDetails.push({
          holeNumber: holeNum,
          winnerId: winners[0].playerId,
          skinsValue: pot,
          scores: scoresMap,
        });
        pot = 1; // Reset pot
      } else {
        // Tie - no winner
        skinDetails.push({
          holeNumber: holeNum,
          winnerId: null,
          skinsValue: pot,
          scores: scoresMap,
        });
        if (carryOver) {
          pot++;
        } else {
          pot = 1;
        }
      }
    }

    // Check completeness
    const allComplete = scoreData.players.every((player) => {
      const playerScores = this.getPlayerScores(scoreData.scores, player.playerId, activeHoles);
      return (
        playerScores.length === activeHoles.length &&
        playerScores.every((s) => s.strokes !== null)
      );
    });

    // Build standings
    const standings: PlayerStanding[] = scoreData.players.map((player) => {
      const holeResults = this.buildHoleResults(
        scoreData.scores,
        scoreData.holes,
        player.playerId,
        useNet ? player.playingHandicap : 0
      );
      const standing = this.createPlayerStanding(player.playerId, holeResults);
      const playerSkins = skinsWon[player.playerId] || [];
      const totalSkinsValue = skinDetails
        .filter((d) => d.winnerId === player.playerId)
        .reduce((sum, d) => sum + d.skinsValue, 0);
      standing.moneyWon = totalSkinsValue * moneyPerSkin;
      standing.metadata = {
        skinsWon: playerSkins.length,
        skinsHoles: playerSkins,
        totalSkinsValue,
      };
      return standing;
    });

    result.playerStandings = this.sortStandings(
      standings,
      (s) => (s.metadata.totalSkinsValue as number) || 0,
      false // Higher is better
    );
    result.isComplete = allComplete;
    result.details = { skinDetails, carryOverPot: pot > 1 ? pot : 0 };

    // Calculate payouts
    if (moneyPerSkin > 0) {
      const payouts: Payout[] = [];
      for (const standing of result.playerStandings) {
        if (standing.moneyWon > 0) {
          payouts.push({
            playerId: standing.playerId,
            amount: standing.moneyWon,
            description: `${(standing.metadata.totalSkinsValue as number)} skins @ $${moneyPerSkin}`,
          });
        }
      }
      result.payouts = payouts;
    }

    return result;
  }
}
