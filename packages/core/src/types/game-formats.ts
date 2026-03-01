// Game engine types - pure TypeScript, no framework deps

export type GameFormatId =
  | 'stroke_play_gross'
  | 'stroke_play_net'
  | 'skins'
  | 'nassau'
  | 'match_play'
  | 'wolf'
  | 'scramble'
  | 'shamble'
  | 'alternate_shot'
  | 'modified_alternate_shot'
  | 'best_ball_2'
  | 'best_ball_3'
  | 'best_ball_4'
  | 'progressive_best_ball';

export type GameCategory = 'individual' | 'team' | 'match';

export interface GameFormatMetadata {
  id: GameFormatId;
  name: string;
  description: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  requiresTeams: boolean;
  handicapAllowance: number; // e.g., 1.0 = 100%, 0.85 = 85%
  defaultConfig: Record<string, unknown>;
  configSchema: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'select' | 'text';
  required: boolean;
  defaultValue: unknown;
  options?: { label: string; value: unknown }[];
  min?: number;
  max?: number;
}

// Data structures passed into game engine calculations

export interface HoleInfo {
  holeNumber: number;
  par: number;
  yardage: number | null;
  handicapIndex: number; // stroke allocation 1-18
}

export interface PlayerInfo {
  playerId: string;
  displayName: string;
  playingHandicap: number;
  teamId?: string | null;
}

export interface HoleScore {
  playerId: string;
  holeNumber: number;
  strokes: number | null;
}

export interface TeamInfo {
  teamId: string;
  teamName: string;
  teamOrder: number | null;
  playerIds: string[];
}

export interface RoundScoreData {
  holes: HoleInfo[];
  players: PlayerInfo[];
  scores: HoleScore[];
  teams: TeamInfo[];
}

// Results

export interface GameResult {
  gameId: string;
  format: GameFormatId;
  isComplete: boolean;
  playerStandings: PlayerStanding[];
  teamStandings: TeamStanding[];
  payouts: Payout[];
  details: Record<string, unknown>; // format-specific extra data
}

export interface PlayerStanding {
  playerId: string;
  position: number;
  tied: boolean;
  totalGross: number;
  totalNet: number;
  holeResults: HoleResult[];
  moneyWon: number;
  metadata: Record<string, unknown>; // format-specific (e.g., skins won)
}

export interface HoleResult {
  holeNumber: number;
  gross: number | null;
  net: number | null;
  strokesReceived: number;
  netVsPar: number | null;
  result?: string; // e.g., 'birdie', 'par', 'bogey', 'won', 'lost', 'halved'
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  position: number;
  tied: boolean;
  totalScore: number;
  moneyWon: number;
  metadata: Record<string, unknown>;
}

export interface Payout {
  playerId: string;
  amount: number;
  description: string;
}

// Game engine interface

export interface IGameFormatEngine {
  readonly formatId: GameFormatId;
  getMetadata(): GameFormatMetadata;
  validateConfig(config: Record<string, unknown>): string[];
  calculateResults(
    scoreData: RoundScoreData,
    config: Record<string, unknown>,
    gameId: string
  ): GameResult;
}
