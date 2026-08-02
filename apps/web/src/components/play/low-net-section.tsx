'use client';

// Low Net payout block on the Leaderboard tab: ranks the whole field by net
// score and pays the top finishers per the game's buy-in/payout config. Updates
// live as scores come in (projected until the round is finalized).

import { useMemo } from 'react';
import { computePayouts } from '@golf/core';
import {
  computeStanding,
  formatToPar,
  type PlayRound,
  type PlayScore,
} from './shared';

export function LowNetSection({
  round,
  scores,
}: {
  round: PlayRound;
  scores: PlayScore[];
}) {
  const ln = round.lowNet;

  const ranked = useMemo(() => {
    const holesFor = (teeBoxId: string) =>
      round.holesByTeeBox[teeBoxId] ?? round.defaultHoles ?? [];
    const started = round.players
      .map((p) => ({ p, st: computeStanding(p, scores, holesFor(p.teeBoxId)) }))
      .filter((x) => x.st.holesPlayed > 0)
      .sort((a, b) => a.st.netToPar - b.st.netToPar);

    const out: { id: string; name: string; netToPar: number; position: number }[] = [];
    let pos = 1;
    started.forEach((x, i) => {
      const position =
        i > 0 && x.st.netToPar === started[i - 1].st.netToPar
          ? out[i - 1].position
          : pos;
      out.push({ id: x.p.id, name: x.p.displayName, netToPar: x.st.netToPar, position });
      pos++;
    });
    return out;
  }, [round.players, round.holesByTeeBox, round.defaultHoles, scores]);

  const payoutById = useMemo(() => {
    const m = new Map<string, number>();
    if (!ln?.payout || ranked.length === 0) return m;
    for (const e of computePayouts(
      ranked.map((r) => ({ id: r.id, position: r.position })),
      ln.payout,
      round.players.length
    )) {
      m.set(e.id, e.amount);
    }
    return m;
  }, [ln, ranked, round.players.length]);

  if (!ln) return null;

  const pot = ln.payout ? ln.payout.buyIn * round.players.length : 0;
  const paid = ranked.filter((r) => (payoutById.get(r.id) ?? 0) > 0);

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-surface-50">Low Net</h3>
          <p className="text-[11px] text-surface-400">
            {ln.payout ? `Pays top ${ln.payout.places}` : 'Lowest net wins'}
            {!round.confirmed && ' · projected'}
          </p>
        </div>
        {ln.payout && (
          <span className="text-[11px] text-surface-300 text-right">
            ${ln.payout.buyIn}/player
            <br />
            pot ${pot}
          </span>
        )}
      </div>

      {paid.length === 0 ? (
        <p className="text-[11px] text-surface-400">
          Standings appear here as scores come in.
        </p>
      ) : (
        <div className="space-y-1.5">
          {paid.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                r.position === 1
                  ? 'bg-gold-500/10 border-gold-500/30'
                  : 'bg-surface-900/40 border-surface-700'
              }`}
            >
              <span className="w-6 text-sm font-bold text-surface-200">{r.position}</span>
              <p className="flex-1 min-w-0 text-sm font-medium text-surface-50 truncate">
                {r.name}
              </p>
              <span className="text-sm font-bold tabular-nums text-surface-100">
                {formatToPar(r.netToPar)}
              </span>
              <span className="w-14 text-right text-sm font-bold text-golf-500 tabular-nums">
                +${payoutById.get(r.id) ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
