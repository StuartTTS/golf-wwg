import { Flag, Swords, Trophy, Ticket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';

/**
 * Single source of truth for the action-centric nav (v2): the "Start" modes and
 * the "Join Game" action. Consumed by the sidebar (desktop, inline), the mobile
 * Start bottom sheet, and — later — the Home action cards, so labels and
 * descriptions stay consistent everywhere. See the nav discussion in
 * docs (home/menu). `available` gates whether the item is a live link or shows
 * a "Soon" placeholder.
 */
export interface NavAction {
  key: string;
  /** Full label, e.g. "Tee It Up Now". */
  label: string;
  /** Terse tag for tight spots, e.g. "Solo". */
  shortTag: string;
  /** One-liner shown on cards / in the sheet / as a hover tooltip. */
  description: string;
  href: string;
  icon: LucideIcon;
  /** Built + flagged on. When false, render disabled with a "Soon" badge. */
  available: boolean;
}

const teeItUpOn = featureFlags.teeItUp && featureFlags.playExperience;

export const startModes: NavAction[] = [
  {
    key: 'tee-it-up',
    label: 'Tee It Up Now',
    shortTag: 'Solo',
    description: 'Just you — track your score & stats',
    href: '/tee-it-up',
    icon: Flag,
    available: teeItUpOn,
  },
  {
    key: 'game-time',
    label: 'Game Time',
    shortTag: 'With friends',
    description: 'One round of side games with friends — skins, best ball, and more',
    href: '#',
    icon: Swords,
    available: false, // Phase 2
  },
  {
    key: 'cup-time',
    label: 'Cup Time',
    shortTag: 'Tournament',
    description: 'A multi-round team event, Ryder Cup style',
    href: '#',
    icon: Trophy,
    available: false, // Phase 3
  },
];

export const joinGame: NavAction = {
  key: 'join-game',
  label: 'Join Game',
  shortTag: 'Join',
  description: "Enter a GameID to join someone's game",
  href: '#',
  icon: Ticket,
  available: false, // Phase 2
};
