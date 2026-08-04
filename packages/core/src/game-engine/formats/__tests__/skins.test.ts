import { describe, it, expect } from 'vitest';
import { SkinsEngine } from '../skins';
import type { RoundScoreData } from '../../../types/game-formats';

const engine = new SkinsEngine();

// Two players, three par-4 holes (gross skins):
//  H1: A 3 (birdie), B 4 → A wins
//  H2: A 4, B 4 → tie, carries
//  H3: A 4 (par), B 5 → A wins (carrying H2's skin)
const data: RoundScoreData = {
  holes: [
    { holeNumber: 1, par: 4, yardage: 400, handicapIndex: 1 },
    { holeNumber: 2, par: 4, yardage: 400, handicapIndex: 2 },
    { holeNumber: 3, par: 4, yardage: 400, handicapIndex: 3 },
  ],
  players: [
    { playerId: 'A', displayName: 'A', playingHandicap: 0 },
    { playerId: 'B', displayName: 'B', playingHandicap: 0 },
  ],
  scores: [
    { playerId: 'A', holeNumber: 1, strokes: 3 },
    { playerId: 'B', holeNumber: 1, strokes: 4 },
    { playerId: 'A', holeNumber: 2, strokes: 4 },
    { playerId: 'B', holeNumber: 2, strokes: 4 },
    { playerId: 'A', holeNumber: 3, strokes: 4 },
    { playerId: 'B', holeNumber: 3, strokes: 5 },
  ],
  teams: [],
};

const valueOf = (res: any, id: string) =>
  (res.playerStandings.find((s: any) => s.playerId === id)?.metadata
    .totalSkinsValue as number) ?? 0;

describe('SkinsEngine birdiesOnly', () => {
  it('normal skins: A wins H1 (1) and H3 (2, carried from H2) = 3', () => {
    const res = engine.calculateResults(
      data,
      { useNet: false, carryOver: true, birdiesOnly: false },
      'g'
    );
    expect(valueOf(res, 'A')).toBe(3);
    expect(valueOf(res, 'B')).toBe(0);
  });

  it('birdies-only: H3 is a par, so it carries — A keeps only the H1 birdie skin', () => {
    const res = engine.calculateResults(
      data,
      { useNet: false, carryOver: true, birdiesOnly: true },
      'g'
    );
    expect(valueOf(res, 'A')).toBe(1);
    expect(valueOf(res, 'B')).toBe(0);
  });
});
