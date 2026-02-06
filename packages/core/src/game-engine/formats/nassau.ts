import type {
  GameFormatMetadata,
  GameResult,
  Payout,
  PlayerStanding,
  RoundScoreData,
} from '../../types/game-formats';
import { BaseGameFormatEngine } from '../base';

interface NassauBet {
  front: { winnerId: string | null; margin: number };
  back: { winnerId: string | null; margin: number };
  overall: { winnerId: string | null; margin: number };
}

export class NassauEngine extends BaseGameFormatEngine {
  readonly formatId = 'nassau' as const;

  getMetadata(): GameFormatMetadata {
    return {
      id: this.formatId,
      name: 'Nassau',
      description:
        'Three separate bets: front 9, back 9, and overall 18. Can be played gross or net.',
      category: 'match',
      minPlayers: 2,
      maxPlayers: 4,
      requiresTeams: false,
      handicapAllowance: 1.0,
      defaultConfig: { useNet: true, autoPresses: false, pressAfter: 2 },
      configSchema: [
        {
          key: 'useNet',
          label: 'Use Net Scores',
          type: 'boolean',
          required: false,
          defaultValue: true,
        },
        {
          key: 'autoPresses',
          label: 'Auto Presses',
          type: 'boolean',
          required: false,
          defaultValue: false,
        },
        {
          key: 'pressAfter',
          label: 'Press When Down By',
          type: 'number',
          required: false,
          defaultValue: 2,
          min: 1,
          max: 5,
        },
      ],
    };
  }

  validateConfig(config: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (config.pressAfter !== undefined) {
      const val = config.pressAfter as number;
      if (typeof val !== 'number' || val < 1 || val > 5) {
        errors.push('pressAfter must be a number between 1 and 5');
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

    if (scoreData.players.length < 2) return result;

    // For simplicity, calculate Nassau as head-to-head between first two players
    // For 3-4 players, each pair could have a Nassau but we'll do the group version
    const frontHoles = scoreData.holes
      .filter((h) => h.holeNumber <= 9)
      .map((h) => h.holeNumber);
    const backHoles = scoreData.holes
      .filter((h) => h.holeNumber > 9)
      .map((h) => h.holeNumber);
    const allHoles = scoreData.holes.map((h) => h.holeNumber);

    // Calculate net totals for each player on each nine and overall
    const playerTotals = scoreData.players.map((player) => {
      const handicap = useNet ? player.playingHandicap : 0;
      const holeResults = this.buildHoleResults(
        scoreData.scores,
        scoreData.holes,
        player.playerId,
        handicap
      );

      const frontNet = holeResults
        .filter((hr) => frontHoles.includes(hr.holeNumber))
        .reduce((sum, hr) => sum + (hr.net ?? 0), 0);
      const backNet = holeResults
        .filter((hr) => backHoles.includes(hr.holeNumber))
        .reduce((sum, hr) => sum + (hr.net ?? 0), 0);
      const overallNet = frontNet + backNet;

      return {
        playerId: player.playerId,
        frontNet,
        backNet,
        overallNet,
        holeResults,
      };
    });

    // Determine winners for each bet
    const getBetWinner = (
      scoreFn: (t: (typeof playerTotals)[0]) => number
    ): { winnerId: string | null; margin: number } => {
      const sorted = [...playerTotals].sort(
        (a, b) => scoreFn(a) - scoreFn(b)
      );
      if (sorted.length < 2) return { winnerId: null, margin: 0 };
      const diff = scoreFn(sorted[1]) - scoreFn(sorted[0]);
      if (diff === 0) return { winnerId: null, margin: 0 };
      return { winnerId: sorted[0].playerId, margin: diff };
    };

    const nassauBets: NassauBet = {
      front: getBetWinner((t) => t.frontNet),
      back: getBetWinner((t) => t.backNet),
      overall: getBetWinner((t) => t.overallNet),
    };

    // Check completeness
    const allComplete = scoreData.players.every((player) => {
      const playerScores = this.getPlayerScores(scoreData.scores, player.playerId, allHoles);
      return (
        playerScores.length === allHoles.length &&
        playerScores.every((s) => s.strokes !== null)
      );
    });

    // Build standings
    const moneyPerBet = (config.moneyPerUnit as number) ?? 0;
    const standings: PlayerStanding[] = playerTotals.map((pt) => {
      const standing = this.createPlayerStanding(
        pt.playerId,
        pt.holeResults
      );

      let betsWon = 0;
      if (nassauBets.front.winnerId === pt.playerId) betsWon++;
      if (nassauBets.back.winnerId === pt.playerId) betsWon++;
      if (nassauBets.overall.winnerId === pt.playerId) betsWon++;

      standing.moneyWon = betsWon * moneyPerBet;
      standing.metadata = {
        frontNet: pt.frontNet,
        backNet: pt.backNet,
        overallNet: pt.overallNet,
        betsWon,
        wonFront: nassauBets.front.winnerId === pt.playerId,
        wonBack: nassauBets.back.winnerId === pt.playerId,
        wonOverall: nassauBets.overall.winnerId === pt.playerId,
      };
      return standing;
    });

    result.playerStandings = this.sortStandings(standings, (s) => s.totalNet);
    result.isComplete = allComplete;
    result.details = { nassauBets };

    // Calculate payouts
    if (moneyPerBet > 0) {
      const payouts: Payout[] = [];
      for (const standing of result.playerStandings) {
        const betsWon = standing.metadata.betsWon as number;
        if (betsWon > 0) {
          payouts.push({
            playerId: standing.playerId,
            amount: standing.moneyWon,
            description: `${betsWon} Nassau bet(s) won @ $${moneyPerBet} each`,
          });
        }
      }
      result.payouts = payouts;
    }

    return result;
  }
}
