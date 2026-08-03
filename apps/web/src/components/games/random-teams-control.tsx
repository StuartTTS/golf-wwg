'use client';

// Draw / re-draw random 2-man best-ball teams from the game page. Mirrors the
// BestBallSection control on the Play → Leaderboard tab, but lives where you tap
// into the game to run it. The all-scores-recorded gate and authorization are
// enforced server-side in the generate_best_ball_teams RPC; we surface its
// message on failure.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateBestBallTeams } from '@/lib/actions/games';
import { Button } from '@/components/ui/button';

export function RandomTeamsControl({
  gameId,
  playerCount,
  hasTeams,
  canManage,
  finalized,
}: {
  gameId: string;
  playerCount: number;
  hasTeams: boolean;
  canManage: boolean;
  finalized: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const oddCount = playerCount % 2 === 1;

  if (finalized) return null;

  if (!canManage) {
    return hasTeams ? null : (
      <p className="text-sm text-surface-300 py-1">
        Teams haven&apos;t been drawn yet — the Commish draws them once everyone finishes.
      </p>
    );
  }

  function run(oddMode: 'leave_out' | 'team_of_3') {
    setError(null);
    start(async () => {
      const res = await generateBestBallTeams({ gameId, oddMode });
      if (res.error) {
        setError(res.error);
        return;
      }
      setDialogOpen(false);
      router.refresh();
    });
  }

  function onClick() {
    setError(null);
    if (oddCount) setDialogOpen(true);
    else run('leave_out');
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={onClick} loading={pending} disabled={pending}>
        {hasTeams ? 'Re-draw random teams' : 'Randomize 2-man teams'}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-16 lg:pb-0">
          <div className="w-full sm:max-w-sm rounded-2xl bg-surface-800 border border-surface-600 p-5 space-y-4">
            <div>
              <h4 className="text-base font-bold text-surface-50">Odd number of players</h4>
              <p className="mt-1 text-sm text-surface-300">
                {playerCount} players won&apos;t split evenly into pairs. How should the
                odd player be handled?
              </p>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="space-y-2">
              <Button className="w-full" onClick={() => run('leave_out')} loading={pending} disabled={pending}>
                Leave one out (doesn&apos;t ante)
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => run('team_of_3')}
                disabled={pending}
              >
                One team of 3
              </Button>
              <button
                className="w-full text-xs text-surface-400 hover:text-surface-200 pt-1"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
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
