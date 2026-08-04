'use client';

// Delete a round with an explicit confirmation. Two shapes: a full "Delete round"
// button (round detail page) and a compact "Delete" link (rounds list). The
// action authorizes creator/admin; RLS is the backstop.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteRound } from '@/lib/actions/rounds';

interface Props {
  roundId: string;
  courseName?: string;
  /** Where to go after a successful delete. Omit to just refresh in place. */
  redirectTo?: string;
  variant?: 'button' | 'link';
  /** Extra classes for the full-button shape (e.g. `w-full` in a grid). */
  className?: string;
}

export function DeleteRoundButton({ roundId, courseName, redirectTo, variant = 'button', className = '' }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = window.confirm(
      `Delete this round${courseName ? ` at ${courseName}` : ''}?\n\n` +
        'This permanently removes its players, scores, and games. This cannot be undone.'
    );
    if (!ok) return;
    start(async () => {
      const res = await deleteRound(roundId);
      if (res.error) {
        alert(res.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  if (variant === 'link') {
    return (
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-golf border border-red-500/40 px-4 text-sm font-medium text-red-400 hover:bg-red-900/20 disabled:opacity-50 ${className}`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      {pending ? 'Deleting…' : 'Delete round'}
    </button>
  );
}
