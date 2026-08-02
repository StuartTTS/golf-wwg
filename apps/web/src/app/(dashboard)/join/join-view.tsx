'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { joinRoundByCode, claimScorer } from '@/lib/actions/rounds';
import { saveJoinProfile, previewJoinClaim, claimGuestSpot } from '@/lib/actions/profile';
import { useSupabase } from '@/providers/supabase-provider';
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
  const { supabase } = useSupabase();
  const [step, setStep] = useState<'code' | 'profile' | 'claim' | 'scorer'>('code');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [spots, setSpots] = useState<{ id: string; guest_name: string }[]>([]);

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

  // When setting up the profile, confirm (debounced) whether the typed email
  // matches a spot the organizer already saved for the joiner — so they know
  // their scores will link up rather than creating a duplicate card.
  const [matchName, setMatchName] = useState<string | null>(null);
  useEffect(() => {
    if (step !== 'profile' || !roundId) {
      setMatchName(null);
      return;
    }
    const candidate = email.trim();
    if (candidate.length < 3) {
      setMatchName(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await previewJoinClaim(roundId, candidate);
      if (!cancelled) setMatchName(res.matchName);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [email, step, roundId]);

  // Unclaimed guest spots the organizer pre-added to this round (readable once
  // the joiner is a group member, which join_round_by_code makes them).
  async function fetchSpots(rId: string) {
    if (!supabase) return [];
    const { data } = await supabase
      .from('round_players')
      .select('id, guest_name')
      .eq('round_id', rId)
      .is('user_id', null)
      .not('guest_name', 'is', null);
    return ((data ?? []) as { id: string; guest_name: string | null }[])
      .filter((r): r is { id: string; guest_name: string } => !!r.guest_name);
  }

  // Offer the claim step if the round still has unclaimed guest spots (the email
  // auto-claim may already have consumed the matching one); else go to scorer.
  async function goAfter(rId: string) {
    const s = await fetchSpots(rId);
    setSpots(s);
    setStep(s.length > 0 ? 'claim' : 'scorer');
  }

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
    // New joiners complete their profile first; established players may claim a
    // pre-added spot, then the scorer question.
    if (!profile.completed) {
      setStep('profile');
    } else {
      await goAfter(res.roundId);
    }
    setSubmitting(false);
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
    if (roundId) await goAfter(roundId);
    else setStep('scorer');
    setSubmitting(false);
  }

  async function claimSpot(id: string) {
    setError(null);
    setSubmitting(true);
    const res = await claimGuestSpot(id);
    setSubmitting(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setStep('scorer');
  }

  async function chooseScorer(yes: boolean) {
    setSubmitting(true);
    // Best-effort — if it fails they can still claim scoring in-round.
    if (yes) await claimScorer(roundId!);
    router.push(`/rounds/${roundId}`);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">Join a Game</h1>
        <p className="mt-1 text-sm text-surface-300">
          {step === 'code'
            ? 'Enter the code the organizer shared with you.'
            : step === 'profile'
              ? 'Set up your profile so your scores and handicap track correctly.'
              : step === 'claim'
                ? 'Link up with the spot the organizer saved for you.'
                : 'One quick thing before you tee off.'}
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
              {matchName ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-golf-400">
                  <span aria-hidden="true">✓</span>
                  <span>
                    We found {matchName}&apos;s spot — your scores will link to
                    it. Use a different email and you&apos;ll show up separately.
                  </span>
                </p>
              ) : null}
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
              {submitting ? 'Saving…' : 'Save & continue'}
            </Button>
          </div>
        </Card>
      )}

      {step === 'claim' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Are you one of these players?</CardTitle>
            <CardDescription>
              The organizer already added these players to the game. Tap your name
              so your scores and games link to that spot.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6 space-y-2">
            {spots.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                className="w-full flex items-center justify-between"
                onClick={() => claimSpot(s.id)}
                disabled={submitting}
              >
                <span>{s.guest_name}</span>
                <span className="text-xs text-surface-400">That&apos;s me</span>
              </Button>
            ))}
            <button
              type="button"
              className="w-full pt-2 text-sm text-surface-400 hover:text-surface-200"
              onClick={() => setStep('scorer')}
              disabled={submitting}
            >
              I&apos;m not on this list
            </button>
          </div>
        </Card>
      )}

      {step === 'scorer' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Are you keeping score for your group?</CardTitle>
            <CardDescription>
              One person usually enters everyone&apos;s scores. Whoever&apos;s
              keeping score can hand it off anytime during the round.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6 space-y-3">
            <Button
              onClick={() => chooseScorer(true)}
              disabled={submitting}
              className="w-full"
            >
              {submitting ? 'Setting up…' : "Yes, I'll keep score"}
            </Button>
            <Button
              variant="outline"
              onClick={() => chooseScorer(false)}
              disabled={submitting}
              className="w-full"
            >
              No, just my own scores
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
