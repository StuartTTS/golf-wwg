import type {
  RoundScoreData,
  HoleInfo,
  PlayerInfo,
  HoleScore,
  TeamInfo,
} from '../types/game-formats';

// Assembles the RoundScoreData a best-ball engine consumes from raw round data.
//
// The crux: players can be on DIFFERENT tee boxes (different stroke indexes), but
// the engine reads a single hole array. So we PRE-NET each player's score using
// THEIR OWN tee box's stroke index and hand the engine net values with
// playingHandicap = 0 — then the engine's per-hole "lowest net ball" is correct
// per player without needing per-tee data. A picked-up (or missing) hole is
// emitted as null so the partner's ball counts.

export interface AssemblePlayer {
  playerId: string;
  displayName: string;
  /** Raw course handicap; the allowance is applied here, not by the engine. */
  playingHandicap: number;
  teeBoxId: string;
}

export interface AssembleHole {
  number: number;
  par: number;
  strokeIndex: number;
  yardage: number | null;
}

export interface AssembleScore {
  playerId: string;
  holeNumber: number;
  strokes: number | null;
  pickup: boolean;
}

export interface AssembleTeam {
  teamId: string;
  teamName: string;
  teamOrder: number | null;
  playerIds: string[];
}

/** Standard stroke allocation from a playing handicap and a hole's stroke index. */
export function strokesReceived(
  playingHandicap: number,
  holeStrokeIndex: number
): number {
  if (playingHandicap >= 0) {
    let strokes = Math.floor(playingHandicap / 18);
    if (holeStrokeIndex <= playingHandicap % 18) strokes += 1;
    return strokes;
  }
  const abs = Math.abs(playingHandicap);
  let strokes = -Math.floor(abs / 18);
  if (holeStrokeIndex > 18 - (abs % 18)) strokes -= 1;
  return strokes;
}

export function assembleBestBallScoreData(input: {
  players: AssemblePlayer[];
  holesByTeeBox: Record<string, AssembleHole[]>;
  defaultHoles: AssembleHole[];
  scores: AssembleScore[];
  teams: AssembleTeam[];
  handicapAllowance?: number;
}): RoundScoreData {
  const allowance = input.handicapAllowance ?? 0.9;
  const teamed = new Set(input.teams.flatMap((t) => t.playerIds));
  const teamOf = new Map<string, string>();
  for (const t of input.teams) for (const pid of t.playerIds) teamOf.set(pid, t.teamId);

  const scoreByKey = new Map<string, AssembleScore>();
  for (const s of input.scores) scoreByKey.set(`${s.playerId}:${s.holeNumber}`, s);

  const players: PlayerInfo[] = [];
  const scores: HoleScore[] = [];

  for (const p of input.players) {
    if (!teamed.has(p.playerId)) continue; // only players actually on a team
    players.push({
      playerId: p.playerId,
      displayName: p.displayName,
      playingHandicap: 0, // scores are pre-netted below
      teamId: teamOf.get(p.playerId) ?? null,
    });
    const teeHoles = input.holesByTeeBox[p.teeBoxId] ?? input.defaultHoles ?? [];
    const ph = Math.round(p.playingHandicap * allowance);
    for (const h of teeHoles) {
      const s = scoreByKey.get(`${p.playerId}:${h.number}`);
      const net =
        !s || s.strokes === null || s.pickup
          ? null
          : s.strokes - strokesReceived(ph, h.strokeIndex);
      scores.push({ playerId: p.playerId, holeNumber: h.number, strokes: net });
    }
  }

  const holes: HoleInfo[] = input.defaultHoles.map((h) => ({
    holeNumber: h.number,
    par: h.par,
    yardage: h.yardage,
    handicapIndex: h.strokeIndex,
  }));

  const teams: TeamInfo[] = input.teams.map((t) => ({
    teamId: t.teamId,
    teamName: t.teamName,
    teamOrder: t.teamOrder,
    playerIds: t.playerIds,
  }));

  return { holes, players, scores, teams };
}
