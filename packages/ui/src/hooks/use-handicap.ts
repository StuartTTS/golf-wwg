import { useMemo } from 'react';
import {
  calculateHandicapIndex,
  calculateCourseHandicap,
  calculateCourseHandicapFull,
  calculatePlayingHandicap,
} from '@golf/core';

interface DifferentialInput {
  roundId: string;
  differential: number;
  date: string;
}

interface UseHandicapOptions {
  differentials: DifferentialInput[];
  slopeRating?: number;
  courseRating?: number;
  par?: number;
  allowancePercent?: number;
}

interface UseHandicapReturn {
  handicapIndex: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
  differentialsUsed: DifferentialInput[];
  roundsCount: number;
}

/**
 * Hook to calculate handicap index and derived values.
 */
export function useHandicap({
  differentials,
  slopeRating,
  courseRating,
  par,
  allowancePercent = 1.0,
}: UseHandicapOptions): UseHandicapReturn {
  return useMemo(() => {
    const result = calculateHandicapIndex(differentials);
    if (!result) {
      return {
        handicapIndex: null,
        courseHandicap: null,
        playingHandicap: null,
        differentialsUsed: [],
        roundsCount: differentials.length,
      };
    }

    let courseHdcp: number | null = null;
    if (slopeRating) {
      courseHdcp =
        courseRating && par
          ? calculateCourseHandicapFull(
              result.handicapIndex,
              slopeRating,
              courseRating,
              par
            )
          : calculateCourseHandicap(result.handicapIndex, slopeRating);
    }

    const playingHdcp =
      courseHdcp !== null
        ? calculatePlayingHandicap(courseHdcp, allowancePercent)
        : null;

    return {
      handicapIndex: result.handicapIndex,
      courseHandicap: courseHdcp,
      playingHandicap: playingHdcp,
      differentialsUsed: result.differentialsUsed,
      roundsCount: result.numRounds,
    };
  }, [differentials, slopeRating, courseRating, par, allowancePercent]);
}
