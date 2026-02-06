'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { acceptInvite, declineInvite } from '@/lib/actions/auth';

interface InviteActionsProps {
  token: string;
}

export default function InviteActions({ token }: InviteActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);

    startTransition(async () => {
      const result = await acceptInvite(token);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push('/home');
      router.refresh();
    });
  }

  function handleDecline() {
    setError(null);

    startTransition(async () => {
      const result = await declineInvite(token);

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
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <Button
          onClick={handleAccept}
          className="flex-1"
          disabled={isPending}
        >
          {isPending ? 'Processing...' : 'Accept Invite'}
        </Button>
        <Button
          onClick={handleDecline}
          variant="outline"
          className="flex-1"
          disabled={isPending}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
