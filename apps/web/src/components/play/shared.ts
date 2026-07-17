// Shared types + helpers for the phone-first "Play" experience
// (Leaderboard / Group Scorecard / Score Entry). Kept separate from the
// legacy scorecard-view so nothing existing breaks.

export type FairwayMiss = 'left' | 'right';
export type GreenMiss = 'short' | 'long' | 'left' | 'right';

export interface PlayHole {
  number: number;
  par: number;
  strokeIndex: number;
  yardage: number;
}

export interface PlayPlayer {
  /** user_id for members, round_players.id for guests. */
  id: string;
  displayName: string;
  handicap: number | null;
  playingHandicap: number;
  teeBoxId: string;
  teeTimeGroupId: string | null;
  isGuest: boolean;
}

export interface PlayTeeGroup {
  id: string;
  name: string;
  teeTime: string | null;
  sortOrder: number;
  /** Designated scorer (profile id). null = each player self-scores. */
  scorerId: string | null;
}

export interface PlayScore {
  playerId: string;
  holeNumber: number;
  strokes: number | null;
  putts: number | null;
  fairwayHit: boolean | null;
  fairwayMiss: FairwayMiss | null;
  gir: boolean | null;
  greenMiss: GreenMiss | null;
  fairwayBunker: boolean | null;
  greensideBunker: boolean | null;
  penalties: number | null;
  upAndDown: boolean | null;
}

export interface PlayRound {
  id: string;
  courseName: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  date: string;
  players: PlayPlayer[];
  holesByTeeBox: Record<string, PlayHole[]>;
  defaultHoles: PlayHole[];
  teeGroups: PlayTeeGroup[];
  currentUserId: string | null;
  currentUserGroupId: string | null;
  /** Leaderboard scoring basis, from the round's games config. */
  scoring: 'gross' | 'net';
}

export function blankScore(playerId: string, holeNumber: number): PlayScore {
  return {
    playerId,
    holeNumber,
    strokes: null,
    putts: null,
    fairwayHit: null,
    fairwayMiss: null,
    gir: null,
    greenMiss: null,
    fairwayBunker: null,
    greensideBunker: null,
    penalties: null,
    upAndDown: null,
  };
}

/** Strokes a player receives on a given hole from their playing handicap. */
export function strokesReceivedOnHole(
  playingHandicap: number,
  holeStrokeIndex: number
): number {
  if (playingHandicap >= 0) {
    let strokes = Math.floor(playingHandicap / 18);
    const remainder = playingHandicap % 18;
    if (holeStrokeIndex <= remainder) strokes += 1;
    return strokes;
  }
  const abs = Math.abs(playingHandicap);
  let strokes = -Math.floor(abs / 18);
  const remainder = abs % 18;
  if (holeStrokeIndex > 18 - remainder) strokes -= 1;
  return strokes;
}

/** Tailwind classes for a strokes-vs-par cell/badge. */
export function scoreToParClasses(strokes: number | null, par: number): string {
  if (strokes === null) return 'text-surface-400';
  const diff = strokes - par;
  if (diff <= -2) return 'bg-score-eagle/20 text-score-eagle font-bold';
  if (diff === -1) return 'bg-score-birdie/20 text-score-birdie font-semibold';
  if (diff === 0) return 'text-surface-50';
  if (diff === 1) return 'bg-score-bogey/20 text-score-bogey';
  return 'bg-score-double/20 text-score-double';
}

export function formatToPar(diff: number): string {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export interface PlayerStanding {
  player: PlayPlayer;
  holesPlayed: number;
  grossStrokes: number;
  parPlayed: number;
  strokesReceived: number;
  grossToPar: number;
  netToPar: number;
  thruLabel: string;
}

/**
 * Compute a standing for one player from their scores + hole info.
 * Gross/net are relative to the par of holes actually played.
 */
export function computeStanding(
  player: PlayPlayer,
  scores: PlayScore[],
  holes: PlayHole[]
): PlayerStanding {
  const holeByNumber = new Map(holes.map((h) => [h.number, h]));
  const played = scores.filter(
    (s) => s.playerId === player.id && s.strokes !== null
  );

  let grossStrokes = 0;
  let parPlayed = 0;
  let strokesReceived = 0;
  for (const s of played) {
    const hole = holeByNumber.get(s.holeNumber);
    if (!hole) continue;
    grossStrokes += s.strokes ?? 0;
    parPlayed += hole.par;
    strokesReceived += strokesReceivedOnHole(
      player.playingHandicap,
      hole.strokeIndex
    );
  }

  const holesPlayed = played.length;
  const netStrokes = grossStrokes - strokesReceived;
  const allDone = holesPlayed >= holes.length && holes.length > 0;

  return {
    player,
    holesPlayed,
    grossStrokes,
    parPlayed,
    strokesReceived,
    grossToPar: grossStrokes - parPlayed,
    netToPar: netStrokes - parPlayed,
    thruLabel: holesPlayed === 0 ? '—' : allDone ? 'F' : `${holesPlayed}`,
  };
}
