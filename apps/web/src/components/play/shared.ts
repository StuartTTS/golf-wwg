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
  /** round_players.id — the confirm/unlock target (distinct from `id`). */
  roundPlayerId: string;
  displayName: string;
  handicap: number | null;
  playingHandicap: number;
  teeBoxId: string;
  teeTimeGroupId: string | null;
  isGuest: boolean;
  /** This player's scorecard is confirmed (locked from edits). */
  confirmed: boolean;
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
  /** Current user is the round creator (Commish) — may finalize/reopen. */
  isCommish: boolean;
  /** Round finalized by the Commish (rounds.confirmed_at set) → counts in stats. */
  confirmed: boolean;
  /** Round scoring mode — 'scorekeeper' means one person scores the whole round. */
  scoringMode: string | null;
  /** The designated whole-round scorekeeper (profile id), when scoringMode is 'scorekeeper'. */
  scorekeeperId: string | null;
}

/**
 * Whether the current user may confirm/unlock a given player's scorecard —
 * the client-side mirror of the can_manage_scorecard RPC (which is the real
 * gate). Self always may; plus the Commish, the whole-round scorekeeper, and
 * the player's flight scorer. Used to decide which confirm controls to show.
 */
export function canManageCard(round: PlayRound, player: PlayPlayer): boolean {
  const me = round.currentUserId;
  if (!me) return false;
  if (!player.isGuest && player.id === me) return true; // own card
  if (round.isCommish) return true;
  if (round.scoringMode === 'scorekeeper' && round.scorekeeperId === me) return true;
  const flight = round.teeGroups.find((g) => g.id === player.teeTimeGroupId);
  return !!flight && flight.scorerId === me;
}

/** Whether the current user may finalize/reopen the whole round (Commish or scorekeeper). */
export function canFinalizeRound(round: PlayRound): boolean {
  const me = round.currentUserId;
  if (!me) return false;
  return (
    round.isCommish ||
    (round.scoringMode === 'scorekeeper' && round.scorekeeperId === me)
  );
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
