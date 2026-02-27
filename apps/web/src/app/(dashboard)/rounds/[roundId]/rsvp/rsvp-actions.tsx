'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { acceptRoundInvite, declineRoundInvite } from '@/lib/actions/rounds';

interface RsvpActionsProps {
  token: string;
  roundId: string;
}

export default function RsvpActions({ token, roundId }: RsvpActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptRoundInvite(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/rounds/${result.roundId ?? roundId}`);
      router.refresh();
    });
  }

  function handleDecline() {
    setError(null);
    startTransition(async () => {
      const result = await declineRoundInvite(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push('/home');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-golf border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleAccept}
          className="w-full bg-golf-600 hover:bg-golf-500 text-white font-semibold h-12 rounded-golf-lg"
          disabled={isPending}
        >
          {isPending ? 'Joining...' : "I'm In!"}
        </Button>
        <Button
          onClick={handleDecline}
          variant="ghost"
          className="w-full text-surface-400 hover:text-surface-300"
          disabled={isPending}
        >
          Can't Make It
        </Button>
      </div>
    </div>
  );
}
