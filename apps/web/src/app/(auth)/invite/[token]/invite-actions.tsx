'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { acceptInvite, declineInvite } from '@/lib/actions/auth';

interface InviteActionsProps {
  token: string;
  groupName: string;
  inviterName: string;
}

export default function InviteActions({ token, groupName, inviterName }: InviteActionsProps) {
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
      router.push(`/groups/${result.groupId}`);
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
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-surface-50">
          Group Invitation
        </h1>
        <p className="mt-4 text-sm text-surface-300">
          <span className="font-medium text-surface-100">{inviterName}</span> has invited you to join
        </p>
        <p className="mt-1 text-lg font-semibold text-surface-50">{groupName}</p>
      </div>

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
          {isPending ? 'Joining...' : 'Accept & Join Group'}
        </Button>
        <Button
          onClick={handleDecline}
          variant="ghost"
          className="w-full text-surface-400 hover:text-surface-300"
          disabled={isPending}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
