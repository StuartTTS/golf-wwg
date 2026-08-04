import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, Badge } from '@/components/ui';
import { assembleBestBallScoreData, gameFormatRegistry } from '@golf/core';

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
         id, user_id, tee_box_id, course_handicap, playing_handicap, guest_name,
         profile:profiles!round_players_user_id_fkey ( display_name )
       )`
    )
    .eq('id', roundId)
    .single();
  if (error || !round) notFound();

  const rps = (round.round_players as any[]) ?? [];

  const { data: scores } = await supabase
    .from('scores')
    .select('round_player_id, hole_number, strokes, pickup')
    .eq('round_id', roundId);

  const teeIds = [...new Set(rps.map((r) => r.tee_box_id).filter(Boolean))];
  const { data: holeRows } = teeIds.length
    ? await supabase
        .from('holes')
        .select('tee_box_id, hole_number, par, handicap_index, yardage')
        .in('tee_box_id', teeIds)
    : { data: [] };

  const { data: gamesRaw } = await supabase
    .from('games')
    .select('id, name, format, status, money_per_unit, config')
    .eq('round_id', roundId)
    .order('created_at', { ascending: true });
  const games = gamesRaw ?? [];
  const gameIds = games.map((g: any) => g.id);

  const { data: gamePlayerRows } = gameIds.length
    ? await supabase
        .from('game_players')
        .select('game_id, round_player_id')
        .in('game_id', gameIds)
    : { data: [] };
  const { data: teamRows } = gameIds.length
    ? await supabase
        .from('game_teams')
        .select('game_id, id, team_name, team_order, game_players ( round_player_id )')
        .in('game_id', gameIds)
        .order('team_order')
    : { data: [] };

  // ---- Shared per-player maps ----------------------------------------
  const nameByRp = new Map<string, string>();
  const chByRp = new Map<string, number>();
  const phByRp = new Map<string, number>();
  const teeByRp = new Map<string, string>();
  for (const rp of rps) {
    nameByRp.set(rp.id, rp.profile?.display_name ?? rp.guest_name ?? 'Guest');
    chByRp.set(rp.id, rp.course_handicap ?? 0);
    phByRp.set(rp.id, rp.playing_handicap ?? rp.course_handicap ?? 0);
    if (rp.tee_box_id) teeByRp.set(rp.id, rp.tee_box_id);
  }
  const grossByRp = new Map<string, number>();
  const playedByRp = new Map<string, number>();
  for (const s of scores ?? []) {
    if (s.strokes == null || !s.round_player_id) continue;
    grossByRp.set(s.round_player_id, (grossByRp.get(s.round_player_id) ?? 0) + s.strokes);
    playedByRp.set(s.round_player_id, (playedByRp.get(s.round_player_id) ?? 0) + 1);
  }
  const holesByTee: Record<string, any[]> = {};
  const parByTee = new Map<string, number>();
  for (const h of holeRows ?? []) {
    (holesByTee[h.tee_box_id] ??= []).push({
      holeNumber: h.hole_number,
      par: h.par,
      yardage: h.yardage ?? 0,
      handicapIndex: h.handicap_index,
    });
    parByTee.set(h.tee_box_id, (parByTee.get(h.tee_box_id) ?? 0) + h.par);
  }
  const defaultHoles = Object.values(holesByTee)[0] ?? [];

  const playersByGame = new Map<string, string[]>();
  for (const gp of gamePlayerRows ?? []) {
    if (!gp.round_player_id) continue;
    (playersByGame.get(gp.game_id) ?? playersByGame.set(gp.game_id, []).get(gp.game_id)!).push(
      gp.round_player_id
    );
  }
  const teamsByGame = new Map<string, any[]>();
  for (const t of teamRows ?? []) {
    (teamsByGame.get(t.game_id) ?? teamsByGame.set(t.game_id, []).get(t.game_id)!).push({
      teamId: t.id,
      teamName: t.team_name,
      teamOrder: t.team_order ?? 0,
      playerIds: (t.game_players ?? []).map((gp: any) => gp.round_player_id),
    });
  }

  const scoreDataScores = (scores ?? [])
    .filter((s: any) => s.round_player_id)
    .map((s: any) => ({
      playerId: s.round_player_id,
      holeNumber: s.hole_number,
      strokes: s.strokes,
      pickup: s.pickup ?? false,
    }));

  // ---- Leader per game -----------------------------------------------
  // Lowest net (gross − course handicap) among a game's players, to par.
  const netLeader = (ids: string[]): string | null => {
    let best: { id: string; net: number } | null = null;
    for (const id of ids) {
      if ((playedByRp.get(id) ?? 0) === 0) continue;
      const net = (grossByRp.get(id) ?? 0) - (chByRp.get(id) ?? 0);
      if (!best || net < best.net) best = { id, net };
    }
    if (!best) return null;
    const par = parByTee.get(teeByRp.get(best.id) ?? '') ?? 0;
    const toPar = par ? best.net - par : null;
    return `${nameByRp.get(best.id) ?? 'Player'}${toPar != null ? ` · net ${toParLabel(toPar)}` : ''}`;
  };

  const gameLeader = (g: any): string | null => {
    const ids = playersByGame.get(g.id) ?? [];
    if (ids.every((id) => (playedByRp.get(id) ?? 0) === 0)) return null; // no scores yet

    if (g.format === 'best_ball_2') {
      const teams = teamsByGame.get(g.id) ?? [];
      if (teams.length === 0) return 'Teams not drawn yet';
      const sd = assembleBestBallScoreData({
        players: rps.map((rp) => ({
          playerId: rp.id,
          displayName: nameByRp.get(rp.id) ?? 'Guest',
          playingHandicap: phByRp.get(rp.id) ?? 0,
          teeBoxId: rp.tee_box_id ?? '',
        })),
        holesByTeeBox: holesByTee,
        defaultHoles,
        scores: scoreDataScores,
        teams,
        handicapAllowance:
          typeof g.config?.handicapAllowance === 'number' ? g.config.handicapAllowance : 0.9,
      } as any);
      const res = gameFormatRegistry
        .getEngine('best_ball_2')
        .calculateResults(sd, { useNet: true, countBest: 1 } as any, g.id);
      const top = res.teamStandings[0];
      if (!top) return null;
      const members = (teams.find((t) => t.teamId === top.teamId)?.playerIds ?? [])
        .map((pid: string) => nameByRp.get(pid) ?? 'Player')
        .join(' & ');
      const toPar = top.metadata?.scoreToPar as number | undefined;
      return `${members}${toPar != null ? ` · ${toParLabel(toPar)}` : ''}`;
    }

    if (g.format === 'skins') {
      const res = gameFormatRegistry.getEngine('skins').calculateResults(
        {
          holes: defaultHoles,
          players: ids.map((id) => ({
            playerId: id,
            displayName: nameByRp.get(id) ?? 'Guest',
            playingHandicap: phByRp.get(id) ?? 0,
          })),
          scores: scoreDataScores.filter((s) => ids.includes(s.playerId)),
          teams: [],
        } as any,
        {
          useNet: g.config?.useNet ?? g.config?.useHandicaps ?? true,
          carryOver: g.config?.carryOver ?? g.config?.carryover ?? true,
          birdiesOnly: g.config?.birdiesOnly === true,
        } as any,
        g.id
      );
      let best: { id: string; skins: number } | null = null;
      for (const st of res.playerStandings) {
        const skins = (st.metadata?.totalSkinsValue as number) ?? 0;
        if (skins > 0 && (!best || skins > best.skins)) best = { id: st.playerId, skins };
      }
      if (!best) return null;
      return `${nameByRp.get(best.id) ?? 'Player'} · ${best.skins} skin${best.skins === 1 ? '' : 's'}`;
    }

    // low_net, stroke play, nassau, etc. — lowest net wins.
    return netLeader(ids);
  };

  // ---- Overall net leaderboard ---------------------------------------
  const rows = rps
    .map((rp) => {
      const holesPlayed = playedByRp.get(rp.id) ?? 0;
      const gross = grossByRp.get(rp.id) ?? 0;
      const par = parByTee.get(rp.tee_box_id ?? '') ?? 0;
      return {
        id: rp.id,
        name: nameByRp.get(rp.id) ?? 'Guest',
        holesPlayed,
        gross,
        net: holesPlayed > 0 ? gross - (chByRp.get(rp.id) ?? 0) : null,
        toPar: holesPlayed > 0 && par ? gross - (chByRp.get(rp.id) ?? 0) - par : null,
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
                      {started ? (r.holesPlayed >= 18 ? 'F' : `${r.holesPlayed}`) : '—'}
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

      {/* Per-game results — leader inline, drills into the full detail page */}
      {games.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-surface-50 px-1">Games</h2>
          {games.map((g: any) => {
            const label = GAME_LABELS[g.format] ?? g.name ?? g.format;
            const buyIn = g.config?.payout?.buyIn ?? g.money_per_unit ?? 0;
            const pot = buyIn * (playersByGame.get(g.id)?.length ?? rps.length);
            const leader = gameLeader(g);
            return (
              <Link key={g.id} href={`/rounds/${roundId}/games/${g.id}`} className="block">
                <Card className="transition-colors hover:bg-surface-700/40">
                  <div className="p-4">
                    <div className="flex items-center gap-3">
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
                    <div className="mt-2 flex items-center gap-1.5 border-t border-surface-700 pt-2">
                      <svg className="w-3.5 h-3.5 text-gold-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.171c.969 0 1.371 1.24.588 1.81l-3.375 2.454a1 1 0 00-.363 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.376-2.453a1 1 0 00-1.175 0l-3.376 2.453c-.784.57-1.838-.196-1.539-1.118l1.287-3.966a1 1 0 00-.363-1.118L2.98 9.393c-.783-.57-.38-1.81.588-1.81h4.17a1 1 0 00.951-.69l1.286-3.966z" />
                      </svg>
                      <span className="text-xs text-surface-200 truncate">
                        {leader ? (
                          <><span className="text-surface-400">Leader: </span>{leader}</>
                        ) : (
                          <span className="text-surface-400">No scores yet</span>
                        )}
                      </span>
                    </div>
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
