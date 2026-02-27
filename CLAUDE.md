# Golf WWG

## Project Overview

Golf group management app for organizing rounds, tracking scores in real-time, running side games (nassau, skins, etc.), and calculating handicaps/payouts among friend groups.

## Architecture

Turborepo monorepo with:
- `apps/web/` - Next.js 15 frontend (App Router, React 19, Tailwind CSS, dark mode theme)
- `packages/core/` - Shared business logic
- `packages/ui/` - Shared UI components
- `supabase/` - Database migrations, seed data, and Edge Functions (Deno)

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 3.4
- **Backend**: Supabase (PostgreSQL 17, Auth, Realtime, Edge Functions)
- **Auth**: Supabase Auth with email signup, SSR middleware
- **Styling**: Tailwind with custom `golf-*` (greens) and `dark-*` color scales, Inter font
- **Validation**: Zod
- **Build**: Turborepo, npm workspaces
- **Deployment**: Vercel (frontend), Supabase (backend/DB)

## Key Commands

```bash
npm run dev          # Start all dev servers
npm run build        # Build all packages and apps
npm run lint         # Lint across workspace
npm run type-check   # TypeScript checks
npm run deploy       # Build + deploy to Vercel (production)
npm run deploy:preview # Build + deploy preview branch
npx supabase db push # Push pending migrations to remote Supabase
```

## Deployment

When asked to "deploy", "push to Vercel", or "ship it":
1. Run `npm run deploy` from the repo root (builds all packages, then deploys `apps/web` to Vercel production)
2. If there are pending Supabase migrations, also run `npx supabase db push`

## Database Schema

Tables (all with RLS): `profiles`, `courses`, `tee_boxes`, `holes`, `groups`, `group_members`, `rounds`, `round_players`, `scores` (realtime enabled), `games`, `game_teams`, `game_players`, `handicap_records`, `invitations`, `settlements`

Key relationships: courses -> tee_boxes -> holes, groups -> group_members, rounds -> round_players -> scores, games -> game_teams -> game_players

## Supabase Edge Functions

- `calculate-handicap` - USGA handicap index calculation
- `calculate-payouts` - Game payout calculations
- `finalize-round` - Round completion workflow
- `send-invitation` - Group/round invitation emails

## Frontend Structure

- `src/app/(auth)/` - Login, register, forgot/reset password, invite acceptance
- `src/app/(dashboard)/` - Main app: home, groups, courses, rounds, profile, settings
- `src/components/` - UI components organized by domain (scorecard, rounds, groups, courses, games, stats, layout, ui)
- `src/lib/supabase/` - Supabase client/server/middleware setup + generated types
- `src/lib/actions/` - Server actions (auth, courses, games, groups, rounds, scores, settlements)
- `src/providers/` - Auth and Supabase context providers
- `src/hooks/` - Custom hooks (e.g., useRealtimeScores)

## Agent Team Guidelines

### Workspace Boundaries
- **Frontend work**: `apps/web/` - pages, components, actions, hooks
- **Backend/DB work**: `supabase/` - migrations, functions, seed data
- **Shared packages**: `packages/` - coordinate carefully, changes affect all consumers

### Conflict Prevention
- Each teammate should own distinct files/directories
- Database migrations are sequential - only one teammate should create migrations at a time
- Shared files to be careful with: `lib/supabase/database.types.ts` (auto-generated), root configs

### Quality Gates
- Run `npm run type-check` before marking frontend tasks complete
- Test migrations locally with `npx supabase db reset` before committing
- Verify RLS policies cover all CRUD operations for new tables
