'use client';

// In-round scorer self-service: any player can start keeping the group's card
// or step back — no Commish needed. There's no "take over": anyone in the
// foursome can already enter anyone's score, so if the keeper leaves after 9,
// whoever picks up the phone just keeps scoring. See claim_scorer /
// release_scorer (migration 00030).

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { claimScorer, releaseScorer } from '@/lib/actions/rounds';

interface Props {
  roundId: string;
  /** Current group scorer's player id, or null if the group self-scores. */
  scorerId: string | null;
  scorerName: string | null;
  /** Am I the current scorer? */
  isMe: boolean;
}

export function ScorerControl({ roundId, scorerId, scorerName, isMe }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });

  // I'm keeping score → offer to step back.
  if (isMe) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-golf-600/40 bg-golf-900/20 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-golf-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          You&apos;re keeping score for the group
        </span>
        <button
          onClick={() => run(() => releaseScorer(roundId))}
          disabled={pending}
          className="text-xs px-2.5 py-1 rounded border border-surface-500 text-surface-200 hover:bg-surface-700 disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? '…' : 'Step back'}
        </button>
      </div>
    );
  }

  // Someone else is keeping the card. No "take over" — you can already enter any
  // score in the foursome; this is just who's on point.
  if (scorerId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-surface-600 bg-surface-700/60 px-4 py-2.5">
        <svg className="w-4 h-4 shrink-0 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="text-sm text-surface-200">
          <span className="font-medium text-surface-100">{scorerName ?? 'Someone'}</span> is
          keeping score for the group.
        </span>
      </div>
    );
  }

  // No one is scoring → offer to keep score for the group.
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-600 bg-surface-800 px-4 py-2.5">
      <span className="text-sm text-surface-300">
        Everyone&apos;s scoring their own card.
      </span>
      <button
        onClick={() => run(() => claimScorer(roundId))}
        disabled={pending}
        className="text-xs px-3 py-1.5 rounded bg-golf-600 text-white font-medium hover:bg-golf-500 disabled:opacity-50 whitespace-nowrap"
      >
        {pending ? '…' : 'Keep score for the group'}
      </button>
    </div>
  );
}
