/**
 * Feature flags. A flag is OFF unless its env var is explicitly the string
 * "true". Because these read `NEXT_PUBLIC_*`, they resolve the same way in
 * server and client components.
 *
 * Enable locally by adding to `apps/web/.env.local`:
 *   NEXT_PUBLIC_FEATURE_PLAY_EXPERIENCE=true
 */
export const featureFlags = {
  /**
   * Phone-first "Play" experience: the /rounds/[id]/play 3-tab shell
   * (Leaderboard / Group Scorecard / Enter), the /rounds/[id]/setup Commish
   * config page, and PGA-style shot-stat capture. Ships dark until enabled.
   */
  playExperience: process.env.NEXT_PUBLIC_FEATURE_PLAY_EXPERIENCE === 'true',

  /**
   * "Tee It Up Now" (Type A): the /tee-it-up solo entry flow (pick course →
   * confirm tees → drop into the Play scoring screen). Lands in the Play
   * experience, so its entry points only render when BOTH this and
   * `playExperience` are on. Ships dark until enabled.
   */
  teeItUp: process.env.NEXT_PUBLIC_FEATURE_TEE_IT_UP === 'true',

  /**
   * Action-centric navigation shell (v2): a "Start" parent → modes (Tee It Up /
   * Game Time / Cup Time, unbuilt modes shown as "Soon"), a "Join Game" button,
   * and Groups/Courses moved into Manage/More. When off, the original
   * object-centric nav (Home · Groups · Courses · Rounds) renders. Ships dark.
   */
  navV2: process.env.NEXT_PUBLIC_FEATURE_NAV_V2 === 'true',

  /**
   * Share code / GameID: a Commish "Share" action on a round and a /join page so
   * friends can join a round by code (adds them to the round's group + as a
   * player). Ships dark.
   */
  shareCode: process.env.NEXT_PUBLIC_FEATURE_SHARE_CODE === 'true',
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
