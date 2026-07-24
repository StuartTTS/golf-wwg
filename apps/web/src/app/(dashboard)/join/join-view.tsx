'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinRoundByCode } from '@/lib/actions/rounds';
import { Card, CardHeader, CardTitle, CardDescription, Button } from '@/components/ui';

export default function JoinView({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    const c = code.trim().toUpperCase();
    if (!c) {
      setError('Enter a code');
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = (await joinRoundByCode(c)) as any;
    if (res?.error) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    router.push(`/rounds/${res.roundId}`);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">Join a Game</h1>
        <p className="mt-1 text-sm text-surface-300">
          Enter the code the organizer shared with you.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/30 p-4 text-sm text-red-400">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Game code</CardTitle>
          <CardDescription>6 characters, e.g. ABC123.</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            inputMode="text"
            autoCapitalize="characters"
            className="w-full rounded-lg bg-surface-900 border border-surface-500 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-surface-50 uppercase focus:border-golf-500 focus:outline-none"
            maxLength={6}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoin();
            }}
          />
          <Button
            onClick={handleJoin}
            disabled={submitting || code.trim().length === 0}
            className="w-full"
          >
            {submitting ? 'Joining…' : 'Join Game'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
