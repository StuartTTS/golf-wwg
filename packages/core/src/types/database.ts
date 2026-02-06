// Supabase-compatible database types
// These mirror the database schema and can be regenerated with supabase gen types

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      groups: {
        Row: Group;
        Insert: GroupInsert;
        Update: GroupUpdate;
      };
      group_members: {
        Row: GroupMember;
        Insert: GroupMemberInsert;
        Update: GroupMemberUpdate;
      };
      courses: {
        Row: Course;
        Insert: CourseInsert;
        Update: CourseUpdate;
      };
      tee_boxes: {
        Row: TeeBox;
        Insert: TeeBoxInsert;
        Update: TeeBoxUpdate;
      };
      holes: {
        Row: Hole;
        Insert: HoleInsert;
        Update: HoleUpdate;
      };
      rounds: {
        Row: Round;
        Insert: RoundInsert;
        Update: RoundUpdate;
      };
      round_players: {
        Row: RoundPlayer;
        Insert: RoundPlayerInsert;
        Update: RoundPlayerUpdate;
      };
      scores: {
        Row: Score;
        Insert: ScoreInsert;
        Update: ScoreUpdate;
      };
      games: {
        Row: Game;
        Insert: GameInsert;
        Update: GameUpdate;
      };
      game_players: {
        Row: GamePlayer;
        Insert: GamePlayerInsert;
        Update: GamePlayerUpdate;
      };
      game_teams: {
        Row: GameTeam;
        Insert: GameTeamInsert;
        Update: GameTeamUpdate;
      };
      handicap_records: {
        Row: HandicapRecord;
        Insert: HandicapRecordInsert;
        Update: HandicapRecordUpdate;
      };
      invitations: {
        Row: Invitation;
        Insert: InvitationInsert;
        Update: InvitationUpdate;
      };
      settlements: {
        Row: Settlement;
        Insert: SettlementInsert;
        Update: SettlementUpdate;
      };
    };
  };
}

// ---------- profiles ----------
export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  default_tee_preference: string | null;
  current_handicap_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string | null;
  default_tee_preference?: string | null;
  current_handicap_index?: number | null;
}

export interface ProfileUpdate {
  display_name?: string;
  email?: string;
  avatar_url?: string | null;
  default_tee_preference?: string | null;
  current_handicap_index?: number | null;
  updated_at?: string;
}

// ---------- groups ----------
export interface Group {
  id: string;
  name: string;
  description: string | null;
  default_course_id: string | null;
  created_by: string;
  created_at: string;
}

export interface GroupInsert {
  name: string;
  description?: string | null;
  default_course_id?: string | null;
  created_by: string;
}

export interface GroupUpdate {
  name?: string;
  description?: string | null;
  default_course_id?: string | null;
}

// ---------- group_members ----------
export type GroupMemberRole = 'admin' | 'member';

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
}

export interface GroupMemberInsert {
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
}

export interface GroupMemberUpdate {
  role?: GroupMemberRole;
}

// ---------- courses ----------
export interface Course {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  num_holes: number;
  created_by: string;
  created_at: string;
}

export interface CourseInsert {
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string;
  num_holes?: number;
  created_by: string;
}

export interface CourseUpdate {
  name?: string;
  city?: string | null;
  state?: string | null;
  country?: string;
  num_holes?: number;
}

// ---------- tee_boxes ----------
export interface TeeBox {
  id: string;
  course_id: string;
  name: string;
  color: string | null;
  slope_rating: number;
  course_rating: number;
  total_yardage: number | null;
}

export interface TeeBoxInsert {
  course_id: string;
  name: string;
  color?: string | null;
  slope_rating: number;
  course_rating: number;
  total_yardage?: number | null;
}

export interface TeeBoxUpdate {
  name?: string;
  color?: string | null;
  slope_rating?: number;
  course_rating?: number;
  total_yardage?: number | null;
}

// ---------- holes ----------
export interface Hole {
  id: string;
  tee_box_id: string;
  hole_number: number;
  par: number;
  yardage: number | null;
  handicap_index: number;
}

export interface HoleInsert {
  tee_box_id: string;
  hole_number: number;
  par: number;
  yardage?: number | null;
  handicap_index: number;
}

export interface HoleUpdate {
  par?: number;
  yardage?: number | null;
  handicap_index?: number;
}

// ---------- rounds ----------
export type RoundStatus = 'upcoming' | 'in_progress' | 'completed';
export type ScoringMode = 'shared' | 'scorekeeper';

export interface Round {
  id: string;
  group_id: string;
  course_id: string;
  tee_box_id: string;
  round_date: string;
  tee_time: string | null;
  status: RoundStatus;
  scoring_mode: ScoringMode;
  scorekeeper_id: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface RoundInsert {
  group_id: string;
  course_id: string;
  tee_box_id: string;
  round_date: string;
  tee_time?: string | null;
  status?: RoundStatus;
  scoring_mode: ScoringMode;
  scorekeeper_id?: string | null;
  created_by: string;
}

export interface RoundUpdate {
  course_id?: string;
  tee_box_id?: string;
  round_date?: string;
  tee_time?: string | null;
  status?: RoundStatus;
  scoring_mode?: ScoringMode;
  scorekeeper_id?: string | null;
  completed_at?: string | null;
}

// ---------- round_players ----------
export type RoundPlayerStatus = 'registered' | 'confirmed' | 'playing' | 'completed' | 'withdrawn';

export interface RoundPlayer {
  id: string;
  round_id: string;
  user_id: string;
  tee_box_id: string;
  handicap_index_at_round: number | null;
  course_handicap: number | null;
  playing_handicap: number | null;
  status: RoundPlayerStatus;
}

export interface RoundPlayerInsert {
  round_id: string;
  user_id: string;
  tee_box_id: string;
  handicap_index_at_round?: number | null;
  course_handicap?: number | null;
  playing_handicap?: number | null;
  status?: RoundPlayerStatus;
}

export interface RoundPlayerUpdate {
  tee_box_id?: string;
  handicap_index_at_round?: number | null;
  course_handicap?: number | null;
  playing_handicap?: number | null;
  status?: RoundPlayerStatus;
}

// ---------- scores ----------
export interface Score {
  id: string;
  round_id: string;
  player_id: string;
  hole_number: number;
  strokes: number | null;
  putts: number | null;
  fairway_hit: boolean | null;
  gir: boolean | null;
  up_and_down: boolean | null;
  entered_by: string;
  updated_at: string;
}

export interface ScoreInsert {
  round_id: string;
  player_id: string;
  hole_number: number;
  strokes?: number | null;
  putts?: number | null;
  fairway_hit?: boolean | null;
  gir?: boolean | null;
  up_and_down?: boolean | null;
  entered_by: string;
}

export interface ScoreUpdate {
  strokes?: number | null;
  putts?: number | null;
  fairway_hit?: boolean | null;
  gir?: boolean | null;
  up_and_down?: boolean | null;
  entered_by?: string;
  updated_at?: string;
}

// ---------- games ----------
export type GameStatus = 'pending' | 'active' | 'finalized';

export interface Game {
  id: string;
  round_id: string;
  format: string;
  name: string | null;
  config: Record<string, unknown>;
  results: Record<string, unknown> | null;
  money_per_unit: number | null;
  status: GameStatus;
  holes: string;
  created_at: string;
}

export interface GameInsert {
  round_id: string;
  format: string;
  name?: string | null;
  config: Record<string, unknown>;
  results?: Record<string, unknown> | null;
  money_per_unit?: number | null;
  status?: GameStatus;
  holes?: string;
}

export interface GameUpdate {
  name?: string | null;
  config?: Record<string, unknown>;
  results?: Record<string, unknown> | null;
  money_per_unit?: number | null;
  status?: GameStatus;
  holes?: string;
}

// ---------- game_players ----------
export interface GamePlayer {
  id: string;
  game_id: string;
  player_id: string;
  team_id: string | null;
  playing_handicap: number | null;
}

export interface GamePlayerInsert {
  game_id: string;
  player_id: string;
  team_id?: string | null;
  playing_handicap?: number | null;
}

export interface GamePlayerUpdate {
  team_id?: string | null;
  playing_handicap?: number | null;
}

// ---------- game_teams ----------
export interface GameTeam {
  id: string;
  game_id: string;
  team_name: string;
  team_order: number | null;
}

export interface GameTeamInsert {
  game_id: string;
  team_name: string;
  team_order?: number | null;
}

export interface GameTeamUpdate {
  team_name?: string;
  team_order?: number | null;
}

// ---------- handicap_records ----------
export interface HandicapRecord {
  id: string;
  user_id: string;
  round_id: string;
  handicap_index: number;
  differentials_used: DifferentialEntry[];
  calculated_at: string;
}

export interface DifferentialEntry {
  round_id: string;
  differential: number;
  date: string;
}

export interface HandicapRecordInsert {
  user_id: string;
  round_id: string;
  handicap_index: number;
  differentials_used: DifferentialEntry[];
}

export interface HandicapRecordUpdate {
  handicap_index?: number;
  differentials_used?: DifferentialEntry[];
}

// ---------- invitations ----------
export type InvitationType = 'group' | 'round';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface Invitation {
  id: string;
  type: InvitationType;
  group_id: string;
  round_id: string | null;
  email: string;
  token: string;
  invited_by: string;
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
}

export interface InvitationInsert {
  type: InvitationType;
  group_id: string;
  round_id?: string | null;
  email: string;
  token: string;
  invited_by: string;
  status?: InvitationStatus;
  expires_at: string;
}

export interface InvitationUpdate {
  status?: InvitationStatus;
}

// ---------- settlements ----------
export type SettlementStatus = 'pending' | 'settled';

export interface Settlement {
  id: string;
  round_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  status: SettlementStatus;
  created_at: string;
}

export interface SettlementInsert {
  round_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  status?: SettlementStatus;
}

export interface SettlementUpdate {
  status?: SettlementStatus;
}
