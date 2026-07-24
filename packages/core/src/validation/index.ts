import { z } from 'zod';

// ---------- Auth ----------
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be under 50 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ---------- Profile ----------
export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  defaultTeeTier: z.number().int().min(1).max(10).nullable().optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

// ---------- Course ----------
export const courseSchema = z.object({
  name: z.string().min(2, 'Course name is required').max(100),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  country: z.string().max(50).default('US'),
  numHoles: z.number().int().min(9).max(36).default(18),
});

export const teeBoxSchema = z.object({
  name: z.string().min(1, 'Tee name is required').max(30),
  color: z.string().optional(),
  tier: z.number().int().min(1).max(10).optional(),
  slopeRating: z.number().min(55).max(155),
  courseRating: z.number().min(55).max(85),
  totalYardage: z.number().int().min(1000).max(9000).optional(),
});

export const holeSchema = z.object({
  holeNumber: z.number().int().min(1).max(36),
  par: z.number().int().min(3).max(6),
  yardage: z.number().int().min(50).max(700).optional(),
  handicapIndex: z.number().int().min(1).max(18),
});

// ---------- Group ----------
export const createGroupSchema = z.object({
  name: z.string().min(2, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
  defaultCourseId: z.string().uuid().optional(),
  homeClubId: z.string().uuid().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member']).default('member'),
});

// ---------- Round ----------
export const createRoundSchema = z.object({
  groupId: z.string().uuid(),
  courseId: z.string().uuid(),
  teeBoxId: z.string().uuid(),
  roundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  teeTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)')
    .optional(),
  scoringMode: z.enum(['shared', 'scorekeeper', 'stroke', 'stableford', 'match', 'skins', 'best_ball']).optional(),
  scorekeeperId: z.string().uuid().optional(),
});

// Solo "Tee It Up Now" round: just a course + tee box. The round hangs off the
// player's personal group and is created already in progress. See
// docs/phase1-type-a-spec.md.
export const createSoloRoundSchema = z.object({
  courseId: z.string().uuid(),
  teeBoxId: z.string().uuid(),
});

// Roster entry (Phase 2). display_name follows the app's single free-text
// convention (2-50, not unique). email is the durable claim key. See
// docs/roster-design.md.
export const rosterPlayerSchema = z.object({
  displayName: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().max(30).optional(),
  handicapIndex: z.number().min(-10).max(54).nullable().optional(),
  linkedUserId: z.string().uuid().nullable().optional(),
});

// ---------- Score ----------
export const scoreEntrySchema = z.object({
  roundId: z.string().uuid(),
  playerId: z.string().uuid(),
  holeNumber: z.number().int().min(1).max(36),
  strokes: z.number().int().min(1).max(20).nullable(),
  putts: z.number().int().min(0).max(10).nullable().optional(),
  fairwayHit: z.boolean().nullable().optional(),
  fairwayMiss: z.enum(['left', 'right']).nullable().optional(),
  gir: z.boolean().nullable().optional(),
  greenMiss: z.enum(['short', 'long', 'left', 'right']).nullable().optional(),
  fairwayBunker: z.boolean().nullable().optional(),
  greensideBunker: z.boolean().nullable().optional(),
  penalties: z.number().int().min(0).max(10).nullable().optional(),
  upAndDown: z.boolean().nullable().optional(),
});

// ---------- Game ----------
export const createGameSchema = z.object({
  roundId: z.string().uuid(),
  format: z.string().min(1),
  name: z.string().max(100).optional(),
  config: z.record(z.unknown()).default({}),
  moneyPerUnit: z.number().min(0).optional(),
  holes: z.string().default('all'),
  playerIds: z.array(z.string().uuid()).min(2),
  teams: z
    .array(
      z.object({
        teamName: z.string(),
        playerIds: z.array(z.string().uuid()),
      })
    )
    .optional(),
});

// ---------- Registration ----------
export const closeRegistrationSchema = z.object({
  roundId: z.string().uuid(),
});

export const reopenRegistrationSchema = z.object({
  roundId: z.string().uuid(),
});

// ---------- Tee Assignment ----------
export const updatePlayerTeeSchema = z.object({
  roundId: z.string().uuid(),
  playerId: z.string().uuid(),
  teeBoxId: z.string().uuid(),
});

export const bulkUpdatePlayerTeesSchema = z.object({
  roundId: z.string().uuid(),
  teeBoxId: z.string().uuid(),
  playerIds: z.array(z.string().uuid()).optional(),
});

// ---------- Settlement ----------
export const settlementSchema = z.object({
  roundId: z.string().uuid(),
  payerId: z.string().uuid(),
  payeeId: z.string().uuid(),
  amount: z.number().min(0.01),
});

// Export types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type TeeBoxInput = z.infer<typeof teeBoxSchema>;
export type HoleInput = z.infer<typeof holeSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type CreateSoloRoundInput = z.infer<typeof createSoloRoundSchema>;
export type RosterPlayerInput = z.infer<typeof rosterPlayerSchema>;
export type ScoreEntryInput = z.infer<typeof scoreEntrySchema>;
export type CreateGameInput = z.infer<typeof createGameSchema>;
export type SettlementInput = z.infer<typeof settlementSchema>;
export type CloseRegistrationInput = z.infer<typeof closeRegistrationSchema>;
export type ReopenRegistrationInput = z.infer<typeof reopenRegistrationSchema>;
export type UpdatePlayerTeeInput = z.infer<typeof updatePlayerTeeSchema>;
export type BulkUpdatePlayerTeesInput = z.infer<typeof bulkUpdatePlayerTeesSchema>;
