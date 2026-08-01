import { describe, it, expect } from 'vitest';
import {
  assembleBestBallScoreData,
  type AssembleHole,
} from '../best-ball-assembly';
import { BestBall2Engine } from '../formats/best-ball';

// A tiny 3-hole course to keep the hand-math tractable. Two tee boxes share hole
// numbers but differ in stroke index on hole 1, so per-player netting must use
// each player's OWN tee box.
const blueHoles: AssembleHole[] = [
  { number: 1, par: 4, strokeIndex: 1, yardage: 400 },
  { number: 2, par: 4, strokeIndex: 9, yardage: 380 },
  { number: 3, par: 3, strokeIndex: 17, yardage: 160 },
];
const redHoles: AssembleHole[] = [
  { number: 1, par: 4, strokeIndex: 5, yardage: 340 },
  { number: 2, par: 4, strokeIndex: 9, yardage: 320 },
  { number: 3, par: 3, strokeIndex: 17, yardage: 140 },
];

describe('assembleBestBallScoreData + BestBall2Engine', () => {
  it('nets per player tee box and picks the lower net ball per hole', () => {
    // Team A: Ann (blue, hcp 0) + Bob (blue, hcp 18 → 0.9 = 16 → strokes on SI 1..16)
    // Team B: Cy (red, hcp 0) + Dee (red, hcp 0)
    const data = assembleBestBallScoreData({
      players: [
        { playerId: 'ann', displayName: 'Ann', playingHandicap: 0, teeBoxId: 'blue' },
        { playerId: 'bob', displayName: 'Bob', playingHandicap: 18, teeBoxId: 'blue' },
        { playerId: 'cy', displayName: 'Cy', playingHandicap: 0, teeBoxId: 'red' },
        { playerId: 'dee', displayName: 'Dee', playingHandicap: 0, teeBoxId: 'red' },
      ],
      holesByTeeBox: { blue: blueHoles, red: redHoles },
      defaultHoles: blueHoles,
      scores: [
        // hole 1
        { playerId: 'ann', holeNumber: 1, strokes: 5, pickup: false },
        { playerId: 'bob', holeNumber: 1, strokes: 5, pickup: false }, // SI1 → gets 1 → net 4
        { playerId: 'cy', holeNumber: 1, strokes: 4, pickup: false },
        { playerId: 'dee', holeNumber: 1, strokes: 6, pickup: false },
        // hole 2
        { playerId: 'ann', holeNumber: 2, strokes: 4, pickup: false },
        { playerId: 'bob', holeNumber: 2, strokes: 4, pickup: false }, // SI9 ≤16 → net 3
        { playerId: 'cy', holeNumber: 2, strokes: 5, pickup: false },
        { playerId: 'dee', holeNumber: 2, strokes: 4, pickup: false },
        // hole 3 — Ann picks up, Bob plays
        { playerId: 'ann', holeNumber: 3, strokes: null, pickup: true },
        { playerId: 'bob', holeNumber: 3, strokes: 3, pickup: false }, // SI17 >16 → net 3
        { playerId: 'cy', holeNumber: 3, strokes: 3, pickup: false },
        { playerId: 'dee', holeNumber: 3, strokes: 4, pickup: false },
      ],
      teams: [
        { teamId: 'A', teamName: 'Team A', teamOrder: 1, playerIds: ['ann', 'bob'] },
        { teamId: 'B', teamName: 'Team B', teamOrder: 2, playerIds: ['cy', 'dee'] },
      ],
      handicapAllowance: 0.9,
    });

    const result = new BestBall2Engine().calculateResults(
      data,
      { useNet: true, countBest: 1 },
      'g1'
    );

    // Team A best net per hole: h1 min(5,4)=4, h2 min(4,3)=3, h3 (Ann X → Bob 3)=3 → 10
    // Team B best net per hole: h1 min(4,6)=4, h2 min(5,4)=4, h3 min(3,4)=3 → 11
    const a = result.teamStandings.find((t) => t.teamId === 'A')!;
    const b = result.teamStandings.find((t) => t.teamId === 'B')!;
    expect(a.totalScore).toBe(10);
    expect(b.totalScore).toBe(11);
    expect(a.position).toBe(1);
    expect(b.position).toBe(2);
  });

  it('excludes players not on a team', () => {
    const data = assembleBestBallScoreData({
      players: [
        { playerId: 'x', displayName: 'X', playingHandicap: 0, teeBoxId: 'blue' },
        { playerId: 'y', displayName: 'Y', playingHandicap: 0, teeBoxId: 'blue' },
        { playerId: 'z', displayName: 'Z (bye)', playingHandicap: 0, teeBoxId: 'blue' },
      ],
      holesByTeeBox: { blue: blueHoles },
      defaultHoles: blueHoles,
      scores: [],
      teams: [{ teamId: 'A', teamName: 'A', teamOrder: 1, playerIds: ['x', 'y'] }],
    });
    expect(data.players.map((p) => p.playerId).sort()).toEqual(['x', 'y']);
  });
});
