# Golf WWG UI Redesign — "The Masters Meets Modern App"

**Date**: 2026-02-23
**Direction**: Golf-Forward & Bold — Augusta-inspired dark theme with gold accents, bold typography, leaderboard aesthetics

---

## Design System Tokens

### Colors

```
/* Primary Greens — Augusta-inspired */
--golf-50:  #f0fdf4    /* lightest mint */
--golf-100: #dcfce7
--golf-200: #bbf7d0
--golf-300: #86efac
--golf-400: #4ade80    /* fairway green */
--golf-500: #22c55e    /* primary green */
--golf-600: #16a34a    /* masters green */
--golf-700: #15803d
--golf-800: #166534    /* deep forest */
--golf-900: #0a3d1f    /* darkest green */

/* Accent Gold — Masters yellow */
--gold-50:  #fefce8
--gold-100: #fef9c3
--gold-200: #fef08a
--gold-300: #fde047
--gold-400: #facc15
--gold-500: #d4a843    /* primary gold */
--gold-600: #b8860b    /* deep gold */
--gold-700: #92711c

/* Dark Surfaces — green-tinted */
--surface-950: #080c0a   /* deepest bg */
--surface-900: #0f1512   /* main bg */
--surface-800: #161e1a   /* card bg */
--surface-700: #1e2a24   /* elevated card */
--surface-600: #2a3830   /* hover state */
--surface-500: #3d4f44   /* borders */
--surface-400: #5a7268   /* muted text */
--surface-300: #8ba89c   /* secondary text */
--surface-200: #b5cec2   /* body text */
--surface-100: #dceee4   /* primary text */
--surface-50:  #f0f9f4   /* bright text */

/* Score Colors */
--score-eagle:   #d4a843  /* gold */
--score-birdie:  #ef4444  /* red */
--score-par:     #f0f9f4  /* white/light */
--score-bogey:   #3b82f6  /* blue */
--score-double:  #1e40af  /* dark blue */
```

### Typography

- **Display/Headings**: Plus Jakarta Sans (bold 700, extrabold 800)
  - H1: 2.5rem/3rem, tracking -0.025em
  - H2: 2rem/2.5rem, tracking -0.02em
  - H3: 1.5rem/2rem, tracking -0.015em
  - H4: 1.25rem/1.75rem
- **Body/UI**: Inter (regular 400, medium 500, semibold 600)
  - Body: 1rem/1.5rem
  - Small: 0.875rem/1.25rem
  - Caption: 0.75rem/1rem
- **Monospace/Scores**: JetBrains Mono or tabular Inter for score numbers

### Spacing Scale
Standard Tailwind + custom golf spacing:
- `golf-sm`: 0.375rem (6px) — tight badge padding
- `golf-md`: 0.75rem (12px) — card internal padding
- `golf-lg`: 1.5rem (24px) — section gaps
- `golf-xl`: 3rem (48px) — page section dividers

### Shadows & Effects
- **Card shadow**: `0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(34,197,94,0.05)`
- **Elevated shadow**: `0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(34,197,94,0.08)`
- **Glow (active)**: `0 0 0 2px rgba(212,168,67,0.3)`
- **Glass effect**: `backdrop-blur-sm bg-surface-800/80`

### Border Radius
- Small: 6px (badges, chips)
- Default: 10px (cards, inputs)
- Large: 16px (modals, panels)
- Full: 9999px (avatars, FABs)

---

## Agent 1: Design System (`design-system`)

### Scope
- `apps/web/tailwind.config.ts` — full theme overhaul
- `apps/web/src/app/globals.css` — CSS variables, base styles
- `apps/web/package.json` — add lucide-react, @fontsource/plus-jakarta-sans
- `apps/web/src/app/layout.tsx` — font loading

### Tasks
1. **Install dependencies**: `lucide-react`, `@fontsource/plus-jakarta-sans`
2. **Update tailwind.config.ts**:
   - Add full color scales: `golf-*`, `gold-*`, `surface-*`
   - Add score color tokens
   - Add custom font family: `display` (Plus Jakarta Sans), `body` (Inter)
   - Add custom shadows: `card`, `elevated`, `glow`
   - Add custom border-radius scale
   - Add transition/animation utilities: `transition-golf` (150ms ease-out)
3. **Update globals.css**:
   - Replace all CSS variables with new design tokens
   - Add base styles for body (surface-900 bg, surface-100 text)
   - Add utility classes: `.glass`, `.score-eagle`, `.score-birdie`, etc.
   - Add smooth scrollbar styling
   - Add selection color (gold highlight)
4. **Update root layout.tsx**: Load Plus Jakarta Sans + Inter fonts

### Files Modified
- `apps/web/tailwind.config.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/package.json`

---

## Agent 2: UI Components (`ui-components`)

**Depends on**: Agent 1 (design-system) must complete first

### Scope
All files in `apps/web/src/components/ui/`

### Tasks

1. **Button** (`button.tsx`):
   - Use new color tokens (golf-600 primary, gold-500 accent variant)
   - Add new variant: `accent` (gold background, dark text)
   - Larger default size (h-11), bolder font (font-semibold)
   - Add subtle scale animation on press (active:scale-[0.98])
   - Improved focus ring with gold glow

2. **Card** (`card.tsx`):
   - Surface-800 background with green-tinted border (surface-500)
   - New shadow-card default
   - Hover state: shadow-elevated + slight translateY(-1px)
   - Add `variant` prop: default, glass, highlighted (gold border)
   - Smooth transition on hover

3. **Input** (`input.tsx`):
   - Surface-800 background, surface-500 border
   - Focus: gold glow ring + golf-500 border
   - Larger text (text-base), more padding
   - Error state: red ring
   - Placeholder color: surface-400

4. **Badge** (`badge.tsx`):
   - Redesign with pill shape (rounded-full)
   - New variants matching golf context: leader (gold), under-par (red), over-par (blue)
   - Bolder font, slightly larger

5. **Select** (`select.tsx`):
   - Match Input styling
   - Dropdown with surface-700 bg, surface-500 borders
   - Hover items: surface-600
   - Add keyboard navigation (arrow keys)
   - Chevron icon from lucide-react

6. **Add new components**:
   - **Avatar**: Golf-green gradient backgrounds, display initials, size variants
   - **Tabs**: Styled tab navigation with gold active indicator
   - **Modal/Dialog**: Centered overlay with glass backdrop
   - **FAB** (Floating Action Button): For "Start Round" on mobile

### Files Modified
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/card.tsx`
- `apps/web/src/components/ui/input.tsx`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/ui/select.tsx`
- `apps/web/src/components/ui/avatar.tsx` (new)
- `apps/web/src/components/ui/tabs.tsx` (new)
- `apps/web/src/components/ui/dialog.tsx` (new)
- `apps/web/src/components/ui/fab.tsx` (new)

---

## Agent 3: Layout & Navigation (`layout-nav`)

**Depends on**: Agent 1 (design-system) must complete first

### Scope
- `apps/web/src/components/layout/`
- `apps/web/src/app/(dashboard)/layout.tsx`

### Tasks

1. **Dashboard Layout** (`layout.tsx`):
   - Fix breakpoint inconsistency (standardize on lg for sidebar)
   - Add smooth transitions between mobile/desktop
   - Surface-950 root background

2. **Sidebar** (`sidebar.tsx`):
   - Width: 280px expanded, 64px collapsed (mini mode)
   - Section headers: "PLAY" (Home, Rounds), "MANAGE" (Groups, Courses), "ACCOUNT" (Profile, Settings)
   - Replace inline SVGs with lucide-react icons
   - Active item: left border accent (golf-500) + gold text
   - Hover: surface-600 background
   - WWG logo at top with golf-ball icon
   - User avatar + name at bottom
   - Collapse toggle button

3. **Header** (`header.tsx`):
   - Subtle gradient: surface-900 → surface-950
   - Breadcrumb navigation on desktop (using current route)
   - Mobile: WWG logo centered, hamburger menu left (optional)
   - "Start Round" quick-action button (right side, golf-500 bg)

4. **Mobile Navigation** (`mobile-nav.tsx`):
   - Height: 64px with safe-area padding
   - 5 tabs: Home, Groups, Courses, Rounds, More
   - Active: gold accent line + filled lucide icon
   - Inactive: surface-400 outlined icon
   - Labels always visible (bold font-medium)
   - Subtle glass background effect

5. **Add "More" drawer** (new component):
   - Slides up from bottom
   - Contains: Profile, Settings, Sign Out
   - Glass backdrop

### Files Modified
- `apps/web/src/app/(dashboard)/layout.tsx`
- `apps/web/src/components/layout/sidebar.tsx`
- `apps/web/src/components/layout/header.tsx`
- `apps/web/src/components/layout/mobile-nav.tsx`
- `apps/web/src/components/layout/more-drawer.tsx` (new)

---

## Agent 4: Pages & Domain Components (`pages-domain`)

**Depends on**: Agents 1, 2, 3 (needs design system, UI components, and layout)

### Scope
- All pages in `apps/web/src/app/(dashboard)/`
- All domain components in `apps/web/src/components/` (scorecard, rounds, groups, courses, games, stats)

### Tasks

1. **Fix ALL hardcoded colors** across every domain component:
   - Replace `bg-white` → `bg-surface-800`
   - Replace `text-slate-*` → `text-surface-*`
   - Replace `border-slate-*` → `border-surface-*`
   - Replace `bg-gray-*` → appropriate surface token
   - Use score color tokens for golf scores

2. **Dashboard Home** (`page.tsx` + `home/`):
   - Hero welcome section with large display font
   - Quick action cards with icons and golf-green gradient accents
   - Recent rounds as leaderboard-style list (rank, player, score, course)
   - Stats summary strip (rounds played, avg score, handicap trend)

3. **Groups pages**:
   - Group cards: Surface-800 bg, member avatars row, gold accent for "your groups"
   - Group detail: Proper Tabs component for Overview/Members/Rounds/Leaderboard
   - Member list: Avatar component, handicap badges, role indicators

4. **Courses pages**:
   - Course cards: Show tee box colors as colored dots
   - Course detail: Leaderboard-style hole table with alternating row stripes
   - Course form: Fix 2-col grid to stack on mobile (grid-cols-1 sm:grid-cols-2)

5. **Scorecard** (the showcase screen):
   - **Mobile**: Card-per-hole with leaderboard ranking
     - Player cards sorted by total score
     - Leader gets gold highlight border
     - Score badges with proper golf colors
     - Swipe gestures for hole navigation
     - Large score entry buttons
   - **Desktop**: Broadcast-style leaderboard grid
     - Alternating row striping (surface-800/surface-700)
     - Header row with hole numbers in golf-500
     - Score cells with colored circles (eagle gold, birdie red, bogey blue)
     - Sticky player name column
     - Animated score updates (fade-in)
   - Score entry modal: Dark glass backdrop, large +/- with golf-ball styling

6. **Game cards & results**:
   - Use new Card component with proper dark theme
   - Money amounts in gold color
   - Winner highlighting with gold border

7. **Round cards**:
   - Status badges using new Badge variants
   - Course name prominent, date secondary
   - Score summary inline

### Files Modified (all files in these dirs):
- `apps/web/src/app/(dashboard)/page.tsx`
- `apps/web/src/app/(dashboard)/home/*`
- `apps/web/src/app/(dashboard)/groups/**`
- `apps/web/src/app/(dashboard)/courses/**`
- `apps/web/src/app/(dashboard)/rounds/**`
- `apps/web/src/components/scorecard/*`
- `apps/web/src/components/rounds/*`
- `apps/web/src/components/groups/*`
- `apps/web/src/components/courses/*`
- `apps/web/src/components/games/*`
- `apps/web/src/components/stats/*`

---

## Agent 5: Auth Pages (`auth-pages`)

**Depends on**: Agent 1 (design-system) must complete first

### Scope
- `apps/web/src/app/(auth)/`

### Tasks

1. **Auth Layout** (`(auth)/layout.tsx`):
   - Full-screen dark green gradient background (surface-950 → golf-900)
   - Centered card with glass effect
   - Large WWG logo with golf-ball icon
   - Subtle pattern or texture overlay (CSS-only)

2. **Login Page** (`login/page.tsx`):
   - Bold "Welcome Back" heading in Plus Jakarta Sans
   - Inputs with new styling (surface-700 bg on the glass card)
   - Primary button full-width, golf-500 with hover golf-600
   - "Forgot Password" as gold text link
   - Register CTA at bottom

3. **Register Page** (`register/page.tsx`):
   - "Join the Club" heading
   - Same input/button styling as login
   - Password strength indicator (optional)

4. **Forgot/Reset Password pages**:
   - Match login styling
   - Success states with golf-green checkmarks

5. **Invite Acceptance** (`invite/[token]/page.tsx`):
   - Show group name prominently
   - "You've been invited to join [Group]" with gold accent
   - Accept button prominent, decline subtle

### Files Modified
- `apps/web/src/app/(auth)/layout.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(auth)/forgot-password/page.tsx`
- `apps/web/src/app/(auth)/reset-password/page.tsx`
- `apps/web/src/app/(auth)/invite/[token]/page.tsx`

---

## Execution Order

```
Phase 1 (parallel start):
  Agent 1: design-system ──────────────┐
                                        │
Phase 2 (after design-system):         │
  Agent 2: ui-components ──────┐       │
  Agent 3: layout-nav ─────────┤       │
  Agent 5: auth-pages ─────────┘       │
                                        │
Phase 3 (after all above):             │
  Agent 4: pages-domain ───────────────┘
```

Agent 1 runs first. Agents 2, 3, 5 run in parallel after. Agent 4 runs last (needs everything).
