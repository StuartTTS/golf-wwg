'use client';

// The 2-Man Best Ball "random teams" block on the Leaderboard tab: a Commish
// generate/redraw control (gated until every score is in) and, once teams are
// drawn, live net team standings + payouts.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useGameResults } from '@golf/ui';
import {
  assembleBestBallScoreData,
  computePayouts,
  type RoundScoreData,
} from '@golf/core';
import { generateBestBallTeams } from '@/lib/actions/games';
import {
  allScoresRecorded,
  formatToPar,
  type PlayRound,
  type PlayScore,
} from './shared';
import { Button } from '@/components/ui/button';

export function BestBallSection({
  round,
  scores,
}: {
  round: PlayRound;
  scores: PlayScore[];
}) {
  const router = useRouter();
  const bb = round.bestBall;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, startGen] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of round.players) m.set(p.id, p.displayName);
    return m;
  }, [round.players]);

  const hasTeams = !!bb && bb.teams.length > 0;
  const antes = useMemo(
    () => (bb ? new Set(bb.teams.flatMap((t) => t.playerIds)).size : 0),
    [bb]
  );

  const scoreData: RoundScoreData | null = useMemo(() => {
    if (!bb || !hasTeams) return null;
    return assembleBestBallScoreData({
      players: round.players.map((p) => ({
        playerId: p.id,
        displayName: p.displayName,
        playingHandicap: p.playingHandicap,
        teeBoxId: p.teeBoxId,
      })),
      holesByTeeBox: round.holesByTeeBox,
      defaultHoles: round.defaultHoles,
      scores,
      teams: bb.teams,
      handicapAllowance: bb.handicapAllowance,
    });
  }, [bb, hasTeams, round.players, round.holesByTeeBox, round.defaultHoles, scores]);

  const { result } = useGameResults({
    formatId: 'best_ball_2',
    scoreData,
    config: { useNet: true, countBest: 1 },
    gameId: bb?.gameId ?? '',
  });

  const payoutByTeam = useMemo(() => {
    const m = new Map<string, number>();
    if (!bb?.payout || !result?.teamStandings.length) return m;
    const paid = computePayouts(
      result.teamStandings.map((t) => ({ id: t.teamId, position: t.position })),
      bb.payout,
      antes
    );
    for (const p of paid) m.set(p.id, p.amount);
    return m;
  }, [bb, result, antes]);

  if (!bb) return null;

  const recorded = allScoresRecorded(round, scores);
  const oddCount = round.players.length % 2 === 1;
  const finalized = bb.status === 'finalized';

  function runGenerate(oddMode: 'leave_out' | 'team_of_3') {
    setError(null);
    startGen(async () => {
      const res = await generateBestBallTeams({ gameId: bb!.gameId, oddMode });
      if (res.error) {
        setError(res.error);
        return;
      }
      setDialogOpen(false);
      router.refresh();
    });
  }

  function onGenerateClick() {
    setError(null);
    if (oddCount) setDialogOpen(true);
    else runGenerate('leave_out');
  }

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-surface-50">2-Man Best Ball</h3>
          <p className="text-[11px] text-surface-400">
            {hasTeams ? 'Random teams · net' : 'Teams drawn after the round'}
          </p>
        </div>
        {bb.payout && (
          <span className="text-[11px] text-surface-300 text-right">
            ${bb.payout.buyIn}/player
            <br />
            pot ${bb.payout.buyIn * antes || bb.payout.buyIn * round.players.length}
          </span>
        )}
      </div>

      {/* Generate / redraw control (Commish only) */}
      {round.canGenerateTeams && !finalized && (
        <div>
          <Button
            size="sm"
            className="w-full"
            onClick={onGenerateClick}
            loading={generating}
            disabled={generating || !recorded}
          >
            {hasTeams ? 'Re-draw teams' : 'Generate 2-man teams'}
          </Button>
          {!recorded && (
            <p className="mt-1.5 text-[11px] text-surface-400 text-center">
              Available once every player has a score (or X) on every hole.
            </p>
          )}
          {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>
      )}
      {!round.canGenerateTeams && !hasTeams && (
        <p className="text-[11px] text-surface-400">
          The Commish draws teams once everyone finishes.
        </p>
      )}

      {/* Team standings */}
      {hasTeams && result && (
        <div className="space-y-1.5">
          {result.teamStandings.map((t) => {
            const members = (bb.teams.find((x) => x.teamId === t.teamId)?.playerIds ?? [])
              .map((pid) => nameById.get(pid) ?? 'Player')
              .join(' & ');
            const toPar = (t.metadata?.scoreToPar as number | undefined) ?? null;
            const won = payoutByTeam.get(t.teamId) ?? 0;
            return (
              <div
                key={t.teamId}
                className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                  t.position === 1
                    ? 'bg-gold-500/10 border-gold-500/30'
                    : 'bg-surface-900/40 border-surface-700'
                }`}
              >
                <span className="w-6 text-sm font-bold text-surface-200">
                  {t.position}
                  {t.tied ? 'T' : ''}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-50 truncate">{members}</p>
                  <p className="text-[11px] text-surface-400">{t.teamName}</p>
                </div>
                {toPar !== null && (
                  <span className="text-sm font-bold tabular-nums text-surface-100">
                    {formatToPar(toPar)}
                  </span>
                )}
                {won > 0 && (
                  <span className="text-sm font-bold text-golf-500 tabular-nums w-14 text-right">
                    +${won}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Odd-count dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-16 lg:pb-0">
          <div className="w-full sm:max-w-sm rounded-2xl bg-surface-800 border border-surface-600 p-5 space-y-4">
            <div>
              <h4 className="text-base font-bold text-surface-50">Odd number of players</h4>
              <p className="mt-1 text-sm text-surface-300">
                {round.players.length} players won&apos;t split evenly into pairs. How
                should the odd player be handled?
              </p>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => runGenerate('leave_out')}
                loading={generating}
                disabled={generating}
              >
                Leave one out (doesn&apos;t ante)
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => runGenerate('team_of_3')}
                disabled={generating}
              >
                One team of 3
              </Button>
              <button
                className="w-full text-xs text-surface-400 hover:text-surface-200 pt-1"
                onClick={() => setDialogOpen(false)}
                disabled={generating}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
