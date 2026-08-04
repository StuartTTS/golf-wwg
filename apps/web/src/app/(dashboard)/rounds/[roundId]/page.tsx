import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button, Badge } from '@/components/ui';
import { featureFlags } from '@/lib/feature-flags';
import { ShareGameButton } from '@/components/rounds/share-game-button';
import { DeleteRoundButton } from '@/components/rounds/delete-round-button';

interface RoundPageProps {
  params: Promise<{ roundId: string }>;
}

/**
 * Round hub — a clean set of destinations, not a config dump. From here you
 * review/confirm, check the leaderboard + game results, edit setup, or manage
 * the round. Everything heavier lives on its own page.
 */
export default async function RoundHubPage({ params }: RoundPageProps) {
  const { roundId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: round, error } = await supabase
    .from('rounds')
    .select(
      'id, status, created_by, group_id, round_date, tee_time, course:courses (id, name)'
    )
    .eq('id', roundId)
    .single();
  if (error || !round) notFound();

  const { data: players } = await supabase
    .from('round_players')
    .select(
      'id, user_id, tee_box_id, status, profile:profiles!round_players_user_id_fkey (display_name)'
    )
    .eq('round_id', roundId);

  let isGroupAdmin = false;
  if (user && round.group_id) {
    const { data: adminCheck } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    isGroupAdmin = adminCheck?.role === 'admin';
  }
  const isCommish = round.created_by === user?.id || isGroupAdmin;
  const playEnabled = featureFlags.playExperience;
  const ownerName =
    (players ?? []).find((p: any) => p.user_id === round.created_by)?.profile
      ?.display_name ?? null;

  // "All scores in" drives the ready-to-confirm banner and whether we still
  // offer an "Enter scores" button. Computed for any not-yet-completed round.
  let allScoresIn = false;
  let scoresRecorded = 0;
  let scoreSlots = 0;
  if (round.status !== 'completed') {
    const teeIds = [
      ...new Set((players ?? []).map((p: any) => p.tee_box_id).filter(Boolean)),
    ];
    const { data: holeRows } = teeIds.length
      ? await supabase
          .from('holes')
          .select('tee_box_id, hole_number')
          .in('tee_box_id', teeIds)
      : { data: [] };
    const holesByTee = new Map<string, number>();
    for (const h of holeRows ?? [])
      holesByTee.set(h.tee_box_id, (holesByTee.get(h.tee_box_id) ?? 0) + 1);

    const { data: recRows } = await supabase
      .from('scores')
      .select('round_player_id, hole_number, strokes, pickup')
      .eq('round_id', roundId);
    const recorded = new Map<string, Set<number>>();
    for (const r of recRows ?? []) {
      if (!r.round_player_id || (r.strokes == null && !r.pickup)) continue;
      const set = recorded.get(r.round_player_id) ?? new Set<number>();
      set.add(r.hole_number);
      recorded.set(r.round_player_id, set);
    }
    const active = (players ?? []).filter((p: any) =>
      ['registered', 'confirmed', 'playing'].includes(p.status)
    );
    let allIn = active.length > 0;
    for (const p of active as any[]) {
      const holes = holesByTee.get(p.tee_box_id ?? '') ?? 0;
      const rec = recorded.get(p.id)?.size ?? 0;
      scoreSlots += holes;
      scoresRecorded += Math.min(rec, holes);
      if (holes === 0 || rec < holes) allIn = false;
    }
    allScoresIn = allIn;
  }

  const status = round.status as string;
  const courseName = (round.course as any)?.name ?? 'Round';

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-surface-50 truncate">
            {courseName}
          </h1>
          <p className="mt-1 text-sm text-surface-300">
            {new Date(round.round_date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
            {round.tee_time && ` · ${round.tee_time}`}
          </p>
        </div>
        <Badge
          variant={
            status === 'completed'
              ? 'default'
              : status === 'in_progress'
                ? 'secondary'
                : 'outline'
          }
          className="capitalize text-sm shrink-0"
        >
          {status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Ready-to-confirm banner */}
      {status === 'in_progress' && (
        <div
          className={`rounded-xl border p-4 ${
            allScoresIn
              ? 'border-golf-600/50 bg-golf-900/20'
              : 'border-surface-600 bg-surface-800/60'
          }`}
        >
          {allScoresIn ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-golf-300">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                All scores are in
              </p>
              <p className="mt-0.5 text-xs text-surface-300">
                {isCommish
                  ? 'Review the scorecard, then confirm the round to post it and settle up.'
                  : 'Review the scorecard — the Commish confirms the round to finish it.'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-surface-100">Round in progress</p>
              <p className="mt-0.5 text-xs text-surface-400">
                {scoreSlots > 0
                  ? `${scoresRecorded} of ${scoreSlots} scores entered.`
                  : 'Enter scores as you play.'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Destinations */}
      <div className="space-y-3">
        {status === 'completed' ? (
          <Link href={`/rounds/${roundId}/results`} className="block">
            <Button className="w-full">View Results</Button>
          </Link>
        ) : (
          <>
            {/* Enter scores — the way in until every score is posted. Hidden once
                the card's full (edits then happen via Review / Confirm). */}
            {!allScoresIn && (
              <Link
                href={playEnabled ? `/rounds/${roundId}/play?tab=enter` : `/rounds/${roundId}/scorecard`}
                className="block"
              >
                <Button className="w-full">
                  {scoresRecorded === 0 ? 'Start Round' : 'Enter Scores'}
                </Button>
              </Link>
            )}
            {status === 'in_progress' && (
              <Link
                href={playEnabled ? `/rounds/${roundId}/play?tab=scorecard` : `/rounds/${roundId}/scorecard`}
                className="block"
              >
                <Button variant={allScoresIn ? 'primary' : 'outline'} className="w-full">
                  Review / Confirm Round
                </Button>
              </Link>
            )}
          </>
        )}

        <Link href={`/rounds/${roundId}/leaderboard`} className="block">
          <Button variant="outline" className="w-full">Leaderboard</Button>
        </Link>

        <Link href={`/rounds/${roundId}/round-setup`} className="block">
          <Button variant="outline" className="w-full">Round Setup</Button>
        </Link>

        {playEnabled && isCommish && (
          <Link href={`/rounds/${roundId}/setup`} className="block">
            <Button variant="outline" className="w-full">Commish Setup</Button>
          </Link>
        )}

        {/* Secondary commish actions — half-width, side by side, matched height */}
        {isCommish && (
          <div className="grid grid-cols-2 gap-3">
            {featureFlags.shareCode ? (
              <ShareGameButton
                roundId={roundId}
                ownerName={ownerName}
                className="w-full"
              />
            ) : (
              <span />
            )}
            <DeleteRoundButton
              roundId={roundId}
              courseName={courseName}
              redirectTo="/rounds"
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
