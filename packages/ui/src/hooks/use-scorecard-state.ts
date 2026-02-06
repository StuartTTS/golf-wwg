import { useCallback, useMemo, useReducer } from 'react';
import type { HoleScore } from '@golf/core';

interface ScorecardState {
  scores: HoleScore[];
  pendingUpdates: HoleScore[];
  activeHole: number;
  activePlayerId: string | null;
}

type ScorecardAction =
  | { type: 'SET_SCORE'; payload: HoleScore }
  | { type: 'MERGE_REMOTE_SCORES'; payload: HoleScore[] }
  | { type: 'CONFIRM_UPDATE'; payload: { playerId: string; holeNumber: number } }
  | { type: 'SET_ACTIVE_HOLE'; payload: number }
  | { type: 'SET_ACTIVE_PLAYER'; payload: string }
  | { type: 'INIT'; payload: HoleScore[] };

function scorecardReducer(
  state: ScorecardState,
  action: ScorecardAction
): ScorecardState {
  switch (action.type) {
    case 'SET_SCORE': {
      const { playerId, holeNumber, strokes } = action.payload;
      // Optimistic update - add to scores and pending
      const existing = state.scores.findIndex(
        (s) => s.playerId === playerId && s.holeNumber === holeNumber
      );
      const newScores = [...state.scores];
      if (existing >= 0) {
        newScores[existing] = { ...newScores[existing], strokes };
      } else {
        newScores.push(action.payload);
      }
      return {
        ...state,
        scores: newScores,
        pendingUpdates: [...state.pendingUpdates, action.payload],
      };
    }

    case 'MERGE_REMOTE_SCORES': {
      // Merge incoming remote scores, preferring pending local updates
      const merged = [...state.scores];
      for (const remote of action.payload) {
        const pendingMatch = state.pendingUpdates.find(
          (p) =>
            p.playerId === remote.playerId &&
            p.holeNumber === remote.holeNumber
        );
        if (pendingMatch) continue; // Keep local optimistic update

        const idx = merged.findIndex(
          (s) =>
            s.playerId === remote.playerId &&
            s.holeNumber === remote.holeNumber
        );
        if (idx >= 0) {
          merged[idx] = remote;
        } else {
          merged.push(remote);
        }
      }
      return { ...state, scores: merged };
    }

    case 'CONFIRM_UPDATE': {
      // Remote confirmed our update, remove from pending
      return {
        ...state,
        pendingUpdates: state.pendingUpdates.filter(
          (p) =>
            !(
              p.playerId === action.payload.playerId &&
              p.holeNumber === action.payload.holeNumber
            )
        ),
      };
    }

    case 'SET_ACTIVE_HOLE':
      return { ...state, activeHole: action.payload };

    case 'SET_ACTIVE_PLAYER':
      return { ...state, activePlayerId: action.payload };

    case 'INIT':
      return {
        ...state,
        scores: action.payload,
        pendingUpdates: [],
      };

    default:
      return state;
  }
}

interface UseScorecardStateOptions {
  initialScores?: HoleScore[];
  numHoles?: number;
  playerIds?: string[];
}

export function useScorecardState({
  initialScores = [],
  numHoles = 18,
  playerIds = [],
}: UseScorecardStateOptions = {}) {
  const [state, dispatch] = useReducer(scorecardReducer, {
    scores: initialScores,
    pendingUpdates: [],
    activeHole: 1,
    activePlayerId: playerIds[0] || null,
  });

  const setScore = useCallback(
    (playerId: string, holeNumber: number, strokes: number | null) => {
      dispatch({
        type: 'SET_SCORE',
        payload: { playerId, holeNumber, strokes },
      });
    },
    []
  );

  const mergeRemoteScores = useCallback((scores: HoleScore[]) => {
    dispatch({ type: 'MERGE_REMOTE_SCORES', payload: scores });
  }, []);

  const confirmUpdate = useCallback(
    (playerId: string, holeNumber: number) => {
      dispatch({ type: 'CONFIRM_UPDATE', payload: { playerId, holeNumber } });
    },
    []
  );

  const setActiveHole = useCallback((hole: number) => {
    dispatch({ type: 'SET_ACTIVE_HOLE', payload: hole });
  }, []);

  const setActivePlayer = useCallback((playerId: string) => {
    dispatch({ type: 'SET_ACTIVE_PLAYER', payload: playerId });
  }, []);

  const initScores = useCallback((scores: HoleScore[]) => {
    dispatch({ type: 'INIT', payload: scores });
  }, []);

  // Derived data
  const getPlayerTotal = useCallback(
    (playerId: string, holeRange?: [number, number]) => {
      return state.scores
        .filter(
          (s) =>
            s.playerId === playerId &&
            s.strokes !== null &&
            (!holeRange ||
              (s.holeNumber >= holeRange[0] && s.holeNumber <= holeRange[1]))
        )
        .reduce((sum, s) => sum + s.strokes!, 0);
    },
    [state.scores]
  );

  const getScore = useCallback(
    (playerId: string, holeNumber: number) => {
      return state.scores.find(
        (s) => s.playerId === playerId && s.holeNumber === holeNumber
      );
    },
    [state.scores]
  );

  const hasPendingUpdates = useMemo(
    () => state.pendingUpdates.length > 0,
    [state.pendingUpdates]
  );

  const completionPercentage = useMemo(() => {
    if (playerIds.length === 0 || numHoles === 0) return 0;
    const totalCells = playerIds.length * numHoles;
    const filledCells = state.scores.filter((s) => s.strokes !== null).length;
    return Math.round((filledCells / totalCells) * 100);
  }, [state.scores, playerIds, numHoles]);

  return {
    scores: state.scores,
    activeHole: state.activeHole,
    activePlayerId: state.activePlayerId,
    hasPendingUpdates,
    completionPercentage,
    setScore,
    mergeRemoteScores,
    confirmUpdate,
    setActiveHole,
    setActivePlayer,
    initScores,
    getPlayerTotal,
    getScore,
  };
}
