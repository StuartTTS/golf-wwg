'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinRoundByCode } from '@/lib/actions/rounds';
import { saveJoinProfile } from '@/lib/actions/profile';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
} from '@/components/ui';

interface JoinProfile {
  displayName: string;
  email: string;
  phone: string;
  handicapIndex: number | null;
  completed: boolean;
}

export default function JoinView({
  initialCode,
  profile,
}: {
  initialCode: string;
  profile: JoinProfile;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'code' | 'profile'>('code');
  const [roundId, setRoundId] = useState<string | null>(null);

  const [code, setCode] = useState(initialCode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile setup fields (prefilled from whatever we already know).
  const [name, setName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [hcp, setHcp] = useState(
    profile.handicapIndex != null ? String(profile.handicapIndex) : ''
  );

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
    setRoundId(res.roundId);
    setSubmitting(false);
    // Established players skip setup; new joiners must complete their profile.
    if (profile.completed) {
      router.push(`/rounds/${res.roundId}`);
    } else {
      setStep('profile');
    }
  }

  async function handleSaveProfile() {
    if (name.trim().length < 2) {
      setError('Enter your name');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }
    setError(null);
    setSubmitting(true);
    const parsedHcp = hcp.trim() === '' ? null : Number(hcp);
    const res = (await saveJoinProfile({
      displayName: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      handicapIndex: Number.isNaN(parsedHcp as number) ? null : parsedHcp,
    })) as any;
    if (res?.error) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    router.push(`/rounds/${roundId}`);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">Join a Game</h1>
        <p className="mt-1 text-sm text-surface-300">
          {step === 'code'
            ? 'Enter the code the organizer shared with you.'
            : 'Set up your profile so your scores and handicap track correctly.'}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/30 p-4 text-sm text-red-400">{error}</div>
      )}

      {step === 'code' && (
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
      )}

      {step === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your profile</CardTitle>
            <CardDescription>You&apos;re in — just confirm your details.</CardDescription>
          </CardHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-100 mb-1">
                Name <span className="text-red-400">*</span>
              </label>
              <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-100 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <Input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1">
                  Phone <span className="text-surface-400 font-normal">(optional)</span>
                </label>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e: any) => setPhone(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1">
                  Handicap
                </label>
                <Input
                  inputMode="decimal"
                  value={hcp}
                  onChange={(e: any) => setHcp(e.target.value)}
                  placeholder="e.g. 12.4"
                />
              </div>
            </div>
            <Button
              onClick={handleSaveProfile}
              disabled={submitting || name.trim().length < 2 || !email.trim()}
              className="w-full"
            >
              {submitting ? 'Saving…' : 'Save & view game'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
