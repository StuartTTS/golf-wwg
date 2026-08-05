'use client';

// Tiered scorecard confirmation, collapsed into one bottom panel:
//   tier 1 — each player confirms their own card (locks it from edits)
//   tier 2 — a flight scorer confirms their whole foursome at once
//   tier 3 — the Commish gives the final sign-off → round posts to stats
// Which controls appear depends on the current user's role (see canManageCard /
// canFinalizeRound in shared.ts; the RPCs are the real gate). See
// docs/round-confirmation-lock.md.

import { useMemo, useState } from 'react';
import {
  type PlayRound,
  type PlayScore,
  type PlayPlayer,
  canManageCard,
  canFinalizeRound,
} from './shared';

interface ConfirmPanelProps {
  round: PlayRound;
  scores: PlayScore[];
  /** roundPlayerId → confirmed (locked). Owned by PlayView so entry locks match. */
  confirmedCards: Record<string, boolean>;
  finalized: boolean;
  /** id (roundPlayerId | flightId | 'round') currently in flight, for spinners. */
  working: string | null;
  error: string | null;
  onConfirmCard: (roundPlayerId: string) => void;
  onUnlockCard: (roundPlayerId: string) => void;
  onConfirmFlight: (flightId: string) => void;
  onFinalize: () => void;
  onReopen: () => void;
  onViewStats: () => void;
  onViewResults: () => void;
}

const Check = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export function ConfirmPanel({
  round,
  scores,
  confirmedCards,
  finalized,
  working,
  error,
  onConfirmCard,
  onUnlockCard,
  onConfirmFlight,
  onFinalize,
  onReopen,
  onViewStats,
  onViewResults,
}: ConfirmPanelProps) {
  const [open, setOpen] = useState(false);
  const canFinalize = canFinalizeRound(round);

  const isConfirmed = (p: PlayPlayer) =>
    confirmedCards[p.roundPlayerId] ?? p.confirmed;

  // Holes played (strokes entered) for a player, and whether the card is full.
  const progress = useMemo(() => {
    const map = new Map<string, { played: number; total: number }>();
    for (const p of round.players) {
      const holes = round.holesByTeeBox[p.teeBoxId] ?? round.defaultHoles ?? [];
      const played = scores.filter(
        (s) => s.playerId === p.id && s.strokes != null
      ).length;
      map.set(p.id, { played, total: holes.length });
    }
    return map;
  }, [round.players, round.holesByTeeBox, round.defaultHoles, scores]);

  const total = round.players.length;
  const confirmedCount = round.players.filter(isConfirmed).length;

  // My own card (member only) — the most common confirm action.
  const myCard = round.players.find(
    (p) => !p.isGuest && p.id === round.currentUserId
  );
  const myCardOpen =
    !!myCard && !isConfirmed(myCard) && canManageCard(round, myCard);

  // Group players by flight for the expanded list (flat list if no flights set).
  const flights = useMemo<
    { id: string | null; name: string; players: PlayPlayer[] }[]
  >(() => {
    const hasFlights = round.players.some((p) => p.teeTimeGroupId !== null);
    if (!hasFlights) {
      return [{ id: null, name: '', players: round.players }];
    }
    const byId = new Map<string | null, PlayPlayer[]>();
    for (const p of round.players) {
      const key = p.teeTimeGroupId;
      (byId.get(key) ?? byId.set(key, []).get(key)!).push(p);
    }
    const groups = round.teeGroups
      .map((g) => ({ id: g.id as string | null, name: g.name, players: byId.get(g.id) ?? [] }))
      .filter((f) => f.players.length > 0);
    if (byId.has(null)) {
      groups.push({ id: null, name: 'Unassigned', players: byId.get(null)! });
    }
    return groups;
  }, [round.players, round.teeGroups]);

  // Can the current user confirm this flight as a whole? (scorer or Commish)
  const canConfirmFlight = (flightId: string | null) => {
    if (!flightId) return false;
    if (canFinalize) return true;
    const g = round.teeGroups.find((x) => x.id === flightId);
    return !!g && g.scorerId === round.currentUserId;
  };

  // ---- Finalized (done) state -------------------------------------------
  if (finalized) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-golf-600/40 bg-golf-900/20 px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-golf-400">
            <Check />
            Final — posted to stats
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewStats}
              className="text-xs text-surface-300 hover:text-surface-100 px-2 py-1"
            >
              View stats
            </button>
            {canFinalize && (
              <button
                onClick={onReopen}
                disabled={working === 'round'}
                className="text-xs px-2 py-1 rounded border border-surface-500 text-surface-200 hover:bg-surface-700 disabled:opacity-50"
              >
                {working === 'round' ? '…' : 'Reopen'}
              </button>
            )}
          </div>
        </div>
        {/* Straight to the results the moment the round's confirmed. */}
        <button
          onClick={onViewResults}
          className="w-full rounded-lg bg-golf-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-golf-500"
        >
          View leaderboard &amp; game results
        </button>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // Nothing to confirm and no authority — don't clutter the screen.
  if (!myCardOpen && !canFinalize && !round.teeGroups.some((g) => canConfirmFlight(g.id))) {
    return null;
  }

  const primaryLabel = myCardOpen ? 'Confirm my card' : canFinalize ? 'Confirm round' : null;
  const onPrimary = myCardOpen
    ? () => onConfirmCard(myCard!.roundPlayerId)
    : canFinalize
      ? onFinalize
      : undefined;
  const primaryWorking = myCardOpen
    ? working === myCard!.roundPlayerId
    : working === 'round';

  return (
    <div className="mt-3 rounded-lg border border-surface-600 bg-surface-800">
      {/* Summary bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-surface-200 hover:text-surface-50"
          aria-expanded={open}
        >
          <svg
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="font-medium">
            {confirmedCount}/{total} confirmed
          </span>
        </button>
        {primaryLabel && (
          <button
            onClick={onPrimary}
            disabled={primaryWorking}
            className="text-xs px-3 py-1.5 rounded bg-golf-600 text-white font-medium hover:bg-golf-500 disabled:opacity-50 whitespace-nowrap"
          >
            {primaryWorking ? 'Confirming…' : primaryLabel}
          </button>
        )}
      </div>

      {/* Expanded per-card list */}
      {open && (
        <div className="border-t border-surface-700 px-3 py-3 space-y-4">
          {flights.map((flight) => {
            const flightOpen = flight.players.filter(
              (p) => !isConfirmed(p)
            ).length;
            return (
              <div key={flight.id ?? 'flat'} className="space-y-1.5">
                {flight.name && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                      {flight.name}
                    </p>
                    {flight.id && canConfirmFlight(flight.id) && flightOpen > 0 && (
                      <button
                        onClick={() => onConfirmFlight(flight.id!)}
                        disabled={working === flight.id}
                        className="text-xs px-2 py-1 rounded border border-golf-600/50 text-golf-300 hover:bg-golf-900/30 disabled:opacity-50"
                      >
                        {working === flight.id ? '…' : `Confirm foursome (${flightOpen})`}
                      </button>
                    )}
                  </div>
                )}
                <ul className="divide-y divide-surface-700/60">
                  {flight.players.map((p) => {
                    const prog = progress.get(p.id) ?? { played: 0, total: 0 };
                    const confirmed = isConfirmed(p);
                    const manage = canManageCard(round, p);
                    const thru =
                      prog.total > 0 && prog.played >= prog.total
                        ? 'F'
                        : `${prog.played}`;
                    return (
                      <li
                        key={p.roundPlayerId}
                        className="flex items-center justify-between gap-2 py-1.5"
                      >
                        <div className="min-w-0">
                          <span className="text-sm text-surface-100 truncate">
                            {p.displayName}
                            {p.id === round.currentUserId && (
                              <span className="ml-1.5 text-[10px] font-semibold text-golf-400">
                                YOU
                              </span>
                            )}
                          </span>
                          <span className="ml-2 text-xs text-surface-400">
                            thru {thru}
                            {prog.total > 0 ? `/${prog.total}` : ''}
                          </span>
                        </div>
                        {confirmed ? (
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="flex items-center gap-1 text-xs font-medium text-golf-400">
                              <Check />
                              Confirmed
                            </span>
                            {manage && (
                              <button
                                onClick={() => onUnlockCard(p.roundPlayerId)}
                                disabled={working === p.roundPlayerId}
                                className="text-xs text-surface-400 hover:text-surface-200 underline disabled:opacity-50"
                              >
                                {working === p.roundPlayerId ? '…' : 'Unlock'}
                              </button>
                            )}
                          </span>
                        ) : manage ? (
                          <button
                            onClick={() => onConfirmCard(p.roundPlayerId)}
                            disabled={working === p.roundPlayerId}
                            className="text-xs px-2.5 py-1 rounded bg-surface-700 text-surface-100 hover:bg-surface-600 disabled:opacity-50 shrink-0"
                          >
                            {working === p.roundPlayerId ? '…' : 'Confirm'}
                          </button>
                        ) : (
                          <span className="text-xs text-surface-500 shrink-0">Open</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {/* Tier 3 — Commish final sign-off */}
          {canFinalize && (
            <div className="border-t border-surface-700 pt-3">
              <button
                onClick={onFinalize}
                disabled={working === 'round'}
                className="w-full text-sm px-3 py-2 rounded bg-golf-600 text-white font-semibold hover:bg-golf-500 disabled:opacity-50"
              >
                {working === 'round' ? 'Finalizing…' : 'Confirm round — final'}
              </button>
              <p className="mt-1.5 text-center text-[11px] text-surface-400">
                Locks every card and posts the round to stats.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="px-3 pb-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
