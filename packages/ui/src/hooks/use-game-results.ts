import { useMemo } from 'react';
import type { GameFormatId, GameResult, RoundScoreData } from '@golf/core';
import { gameFormatRegistry } from '@golf/core';

interface UseGameResultsOptions {
  formatId: GameFormatId;
  scoreData: RoundScoreData | null;
  config: Record<string, unknown>;
  gameId: string;
}

interface UseGameResultsReturn {
  result: GameResult | null;
  isComplete: boolean;
  formatName: string;
}

/**
 * Hook to reactively calculate game results from score data.
 * Pure computation - no DOM or Native dependencies.
 */
export function useGameResults({
  formatId,
  scoreData,
  config,
  gameId,
}: UseGameResultsOptions): UseGameResultsReturn {
  const engine = useMemo(() => {
    if (!gameFormatRegistry.hasFormat(formatId)) return null;
    return gameFormatRegistry.getEngine(formatId);
  }, [formatId]);

  const result = useMemo(() => {
    if (!engine || !scoreData) return null;
    return engine.calculateResults(scoreData, config, gameId);
  }, [engine, scoreData, config, gameId]);

  const formatName = engine?.getMetadata().name ?? formatId;

  return {
    result,
    isComplete: result?.isComplete ?? false,
    formatName,
  };
}
