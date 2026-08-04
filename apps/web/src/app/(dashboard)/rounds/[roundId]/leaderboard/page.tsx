import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, Badge } from '@/components/ui';

interface LeaderboardPageProps {
  params: Promise<{ roundId: string }>;
}

const GAME_LABELS: Record<string, string> = {
  nassau: 'Nassau',
  skins: 'Skins',
  wolf: 'Wolf',
  best_ball: 'Best Ball',
  best_ball_2: '2-Man Best Ball',
  progressive_best_ball: 'Progressive Best Ball',
  low_net: 'Low Net',
  match_play: 'Match Play',
  stableford: 'Stableford',
  bingo_bango_bongo: 'Bingo Bango Bongo',
  stroke_play_net: 'Stroke Play (Net)',
  stroke_play_gross: 'Stroke Play (Gross)',
};

const toParLabel = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`);

export default async function LeaderboardPage({ params }: LeaderboardPageProps) {
  const { roundId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: round, error } = await supabase
    .from('rounds')
    .select(
      `id, status, round_date, course:courses ( name ),
       round_players (
         id, user_id, tee_box_id, course_handicap, guest_name,
         profile:profiles!round_players_user_id_fkey ( display_name )
       )`
    )
    .eq('id', roundId)
    .single();
  if (error || !round) notFound();

  const { data: scores } = await supabase
    .from('scores')
    .select('round_player_id, hole_number, strokes')
    .eq('round_id', roundId);

  const teeId = (round.round_players as any[])[0]?.tee_box_id;
  const { data: holes } = teeId
    ? await supabase.from('holes').select('par').eq('tee_box_id', teeId)
    : { data: [] };
  const totalPar = (holes ?? []).reduce((s: number, h: any) => s + h.par, 0);

  const { data: games } = await supabase
    .from('games')
    .select('id, name, format, status, money_per_unit, config')
    .eq('round_id', roundId)
    .order('created_at', { ascending: true });

  const playerCount = (round.round_players as any[]).length;

  // Net leaderboard: net = gross − course handicap; players who haven't started
  // sink to the bottom with a blank score.
  const rows = (round.round_players as any[])
    .map((rp: any) => {
      const ps = (scores ?? []).filter(
        (s: any) => s.round_player_id === rp.id && s.strokes != null
      );
      const holesPlayed = ps.length;
      const gross = ps.reduce((s: number, x: any) => s + (x.strokes ?? 0), 0);
      const ch = rp.course_handicap ?? 0;
      return {
        id: rp.id,
        name: rp.profile?.display_name ?? rp.guest_name ?? 'Guest',
        holesPlayed,
        gross,
        net: holesPlayed > 0 ? gross - ch : null,
        toPar: holesPlayed > 0 ? gross - totalPar : null,
      };
    })
    .sort((a, b) => {
      const as = a.holesPlayed > 0 ? 0 : 1;
      const bs = b.holesPlayed > 0 ? 0 : 1;
      if (as !== bs) return as - bs;
      if (as === 0) return (a.net ?? 0) - (b.net ?? 0);
      return a.name.localeCompare(b.name);
    });

  const anyStarted = rows.some((r) => r.holesPlayed > 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/rounds/${roundId}`}
          className="text-sm text-surface-300 hover:text-surface-100 mb-1 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to round
        </Link>
        <h1 className="text-2xl font-bold text-surface-50">Leaderboard</h1>
        <p className="text-sm text-surface-300">{(round.course as any)?.name}</p>
      </div>

      {/* Net leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Net</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4">
          {!anyStarted ? (
            <p className="text-sm text-surface-300 py-4">No scores yet.</p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                <span className="w-6" />
                <span className="flex-1">Player</span>
                <span className="w-14 text-right">Thru</span>
                <span className="w-12 text-right">Gross</span>
                <span className="w-12 text-right">Net</span>
              </div>
              {rows.map((r, i) => {
                const started = r.holesPlayed > 0;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-2 rounded-lg p-2.5 ${
                      i === 0 && started
                        ? 'bg-gold-500/10 border border-gold-500/30'
                        : 'hover:bg-surface-700/40'
                    }`}
                  >
                    <span className="w-6 text-sm font-bold text-surface-200">
                      {started ? i + 1 : '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-50 truncate">{r.name}</p>
                    </div>
                    <span className="w-14 text-right text-xs text-surface-300">
                      {started
                        ? r.holesPlayed >= 18
                          ? 'F'
                          : `${r.holesPlayed}`
                        : '—'}
                    </span>
                    <span className="w-12 text-right text-sm tabular-nums text-surface-100">
                      {started ? r.gross : '-'}
                    </span>
                    <span className="w-12 text-right text-sm font-bold tabular-nums text-surface-50">
                      {r.net != null ? r.net : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Per-game results — summary card that drills into the full detail page */}
      {(games ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-surface-50 px-1">Games</h2>
          {(games ?? []).map((g: any) => {
            const label = GAME_LABELS[g.format] ?? g.name ?? g.format;
            const buyIn = g.config?.payout?.buyIn ?? g.money_per_unit ?? 0;
            const pot = buyIn * playerCount;
            return (
              <Link
                key={g.id}
                href={`/rounds/${roundId}/games/${g.id}`}
                className="block"
              >
                <Card className="transition-colors hover:bg-surface-700/40">
                  <div className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-50 truncate">
                        {g.name || label}
                      </p>
                      <p className="text-xs text-surface-400">
                        {label}
                        {pot > 0 ? ` · pot $${pot}` : ''}
                      </p>
                    </div>
                    <Badge
                      variant={g.status === 'finalized' ? 'default' : 'secondary'}
                      className="capitalize shrink-0"
                    >
                      {g.status === 'finalized' ? 'Final' : 'Live'}
                    </Badge>
                    <span className="text-sm text-surface-300 shrink-0 inline-flex items-center gap-0.5">
                      Results
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
