'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge } from '@/components/ui';
import { updateGameScoring } from '@/lib/actions/games';
import { setFlightScorer } from '@/lib/actions/rounds';

export interface SetupGame {
  id: string;
  format: string;
  name: string | null;
  useNet: boolean;
  handicapAllowance: number | null;
}

export interface SetupFlightMember {
  userId: string;
  displayName: string;
}

export interface SetupFlight {
  id: string;
  name: string;
  scorerId: string | null;
  members: SetupFlightMember[];
}

interface SetupViewProps {
  roundId: string;
  courseName: string;
  canEdit: boolean;
  games: SetupGame[];
  flights: SetupFlight[];
}

const GAME_LABELS: Record<string, string> = {
  nassau: 'Nassau',
  skins: 'Skins',
  wolf: 'Wolf',
  best_ball: 'Best Ball',
  progressive_best_ball: 'Progressive Best Ball',
  stableford: 'Stableford',
  match_play: 'Match Play',
  bingo_bango_bongo: 'Bingo Bango Bongo',
  alternate_shot: 'Alternate Shot',
  modified_alternate_shot: 'Modified Alternate Shot',
  scramble: 'Scramble',
};

// Engine defaults per format (fraction) — used when a game hasn't set one yet.
const FORMAT_DEFAULT_ALLOWANCE: Record<string, number> = {
  nassau: 1.0,
  match_play: 1.0,
  best_ball: 0.9,
  progressive_best_ball: 0.85,
  alternate_shot: 0.5,
  modified_alternate_shot: 0.6,
};

export default function SetupView({
  roundId,
  courseName,
  canEdit,
  games,
  flights,
}: SetupViewProps) {
  const router = useRouter();
  const [gameState, setGameState] = useState<SetupGame[]>(games);
  const [flightState, setFlightState] = useState<SetupFlight[]>(flights);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const setBusyKey = (key: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const allowancePct = (g: SetupGame) =>
    Math.round(
      (g.handicapAllowance ?? FORMAT_DEFAULT_ALLOWANCE[g.format] ?? 1) * 100
    );

  const saveGame = (
    id: string,
    patch: { useNet?: boolean; handicapAllowance?: number }
  ) => {
    setBusyKey(`game:${id}`, true);
    startTransition(async () => {
      const res = await updateGameScoring(id, patch);
      if (res.error) {
        alert(res.error);
        router.refresh();
      }
      setBusyKey(`game:${id}`, false);
    });
  };

  const changeUseNet = (id: string, useNet: boolean) => {
    setGameState((prev) =>
      prev.map((g) => (g.id === id ? { ...g, useNet } : g))
    );
    saveGame(id, { useNet });
  };

  const changeAllowance = (id: string, pct: number) => {
    const clamped = Math.max(0, Math.min(150, pct));
    const fraction = clamped / 100;
    setGameState((prev) =>
      prev.map((g) => (g.id === id ? { ...g, handicapAllowance: fraction } : g))
    );
    saveGame(id, { handicapAllowance: fraction });
  };

  const changeScorer = (flightId: string, scorerId: string | null) => {
    setFlightState((prev) =>
      prev.map((f) => (f.id === flightId ? { ...f, scorerId } : f))
    );
    setBusyKey(`flight:${flightId}`, true);
    startTransition(async () => {
      const res = await setFlightScorer(flightId, scorerId);
      if (res.error) {
        alert(res.error);
        router.refresh();
      }
      setBusyKey(`flight:${flightId}`, false);
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/rounds/${roundId}`}
          className="text-sm text-surface-300 hover:text-surface-100 mb-2 inline-block"
        >
          &larr; Back to round
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-surface-50">
            Commish Setup
          </h1>
          <Badge variant="secondary">Commish</Badge>
        </div>
        <p className="mt-1 text-sm text-surface-300">{courseName}</p>
      </div>

      {!canEdit && (
        <div className="rounded-lg bg-surface-800 border border-surface-600 px-4 py-3 text-sm text-surface-200">
          Only the Commish (round creator) or a group admin can change these
          settings. You&apos;re viewing them read-only.
        </div>
      )}

      {/* Games: gross/net + handicap allowance per game */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Game Scoring</CardTitle>
          <CardDescription>
            Set gross vs net and the handicap allowance for each game
            independently (e.g. Skins net at 100%, Match Play at 80%).
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          {gameState.length === 0 ? (
            <div className="text-sm text-surface-300">
              No games yet.{' '}
              <Link
                href={`/rounds/${roundId}/games`}
                className="text-golf-400 hover:underline"
              >
                Add a game
              </Link>
              .
            </div>
          ) : (
            gameState.map((g) => {
              const label = g.name || GAME_LABELS[g.format] || g.format;
              const pct = allowancePct(g);
              const saving = busy.has(`game:${g.id}`);
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-surface-600 bg-surface-800 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-surface-50">{label}</p>
                      <p className="text-xs text-surface-400">
                        {GAME_LABELS[g.format] || g.format}
                      </p>
                    </div>
                    {saving && (
                      <span className="text-xs text-surface-400 animate-pulse">
                        Saving…
                      </span>
                    )}
                  </div>

                  {/* Gross / Net */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-surface-300">Scoring</span>
                    <div className="inline-flex rounded-lg bg-surface-700 p-0.5 text-sm">
                      {[
                        { label: 'Net', value: true },
                        { label: 'Gross', value: false },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          disabled={!canEdit}
                          onClick={() => changeUseNet(g.id, opt.value)}
                          className={`px-3 py-1 rounded-md transition-colors disabled:opacity-50 ${
                            g.useNet === opt.value
                              ? 'bg-golf-600 text-white font-medium'
                              : 'text-surface-300 hover:text-surface-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Handicap allowance */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-surface-300">
                      Handicap allowance
                    </span>
                    <div
                      className={`flex items-center gap-3 ${
                        !g.useNet ? 'opacity-40' : ''
                      }`}
                    >
                      <button
                        disabled={!canEdit || !g.useNet}
                        onClick={() => changeAllowance(g.id, pct - 5)}
                        className="w-8 h-8 rounded-lg bg-surface-700 text-surface-200 hover:bg-surface-600 text-lg font-bold disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-12 text-center text-sm font-bold tabular-nums text-surface-50">
                        {pct}%
                      </span>
                      <button
                        disabled={!canEdit || !g.useNet}
                        onClick={() => changeAllowance(g.id, pct + 5)}
                        className="w-8 h-8 rounded-lg bg-surface-700 text-surface-200 hover:bg-surface-600 text-lg font-bold disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Flights: designate a scorer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Group Scorers</CardTitle>
          <CardDescription>
            Optionally let one person enter scores for a whole flight. When a
            scorer is set, only that person&apos;s shot stats (GIR, FIR, etc.)
            are tracked.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          {flightState.length === 0 ? (
            <div className="text-sm text-surface-300">
              No tee-time groups yet. Create flights from the round page, then
              assign scorers here.
            </div>
          ) : (
            flightState.map((f) => {
              const saving = busy.has(`flight:${f.id}`);
              return (
                <div
                  key={f.id}
                  className="rounded-xl border border-surface-600 bg-surface-800 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-surface-50">{f.name}</p>
                    {saving && (
                      <span className="text-xs text-surface-400 animate-pulse">
                        Saving…
                      </span>
                    )}
                  </div>
                  {f.members.length === 0 ? (
                    <p className="text-xs text-surface-400">
                      No registered members in this flight (guests can&apos;t
                      score).
                    </p>
                  ) : (
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-sm text-surface-300">Scorer</span>
                      <select
                        disabled={!canEdit}
                        value={f.scorerId ?? ''}
                        onChange={(e) =>
                          changeScorer(f.id, e.target.value || null)
                        }
                        className="flex-1 max-w-[220px] rounded-lg bg-surface-700 border border-surface-600 px-3 py-2 text-sm text-surface-50 disabled:opacity-50"
                      >
                        <option value="">Everyone self-scores</option>
                        {f.members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="flex gap-3">
        <Link href={`/rounds/${roundId}/games`} className="flex-1">
          <Button variant="outline" className="w-full">
            Manage Games
          </Button>
        </Link>
        <Link href={`/rounds/${roundId}/play`} className="flex-1">
          <Button className="w-full">Go to Play</Button>
        </Link>
      </div>
    </div>
  );
}
