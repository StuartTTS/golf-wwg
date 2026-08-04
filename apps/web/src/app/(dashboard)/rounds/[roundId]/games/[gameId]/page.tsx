import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  computePayouts,
  assembleBestBallScoreData,
  gameFormatRegistry,
  type PayoutConfig,
} from '@golf/core';
import { RandomTeamsControl } from '@/components/games/random-teams-control';

const GAME_LABELS: Record<string, string> = {
  nassau: 'Nassau',
  skins: 'Skins',
  wolf: 'Wolf',
  best_ball: 'Best Ball',
  best_ball_2: '2-Man Best Ball',
  progressive_best_ball: 'Progressive Best Ball',
  low_net: 'Low Net',
  match_play: 'Match Play',
  stroke_play_net: 'Stroke Play (Net)',
  stroke_play_gross: 'Stroke Play (Gross)',
};

interface GamePageProps {
  params: Promise<{ roundId: string; gameId: string }>;
}

export default async function GameResultsPage({ params }: GamePageProps) {
  const { roundId, gameId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: game } = await supabase
    .from('games')
    .select('id, format, name, config, money_per_unit, status, round_id')
    .eq('id', gameId)
    .single();
  if (!game) notFound();

  // Who may draw/redraw teams: round creator, scorekeeper, or a group admin.
  // (The RPC is the real gate; this just decides whether to show the button.)
  const { data: { user } } = await supabase.auth.getUser();
  const { data: gameRound } = await supabase
    .from('rounds')
    .select('created_by, group_id, scorekeeper_id')
    .eq('id', game.round_id)
    .single();
  let canManage = false;
  if (user && gameRound) {
    canManage =
      gameRound.created_by === user.id || gameRound.scorekeeper_id === user.id;
    if (!canManage && gameRound.group_id) {
      const { data: membership } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', gameRound.group_id)
        .eq('user_id', user.id)
        .maybeSingle();
      canManage = membership?.role === 'admin';
    }
  }
  const isRandomTeams =
    game.format === 'best_ball_2' && (game.config as any)?.randomTeams === true;

  const [{ data: rps }, { data: scoreRows }, { data: gps }, { data: teamRows }] =
    await Promise.all([
      supabase
        .from('round_players')
        .select(
          'id, user_id, tee_box_id, course_handicap, playing_handicap, guest_name, profiles:profiles!round_players_user_id_fkey(display_name)'
        )
        .eq('round_id', game.round_id),
      supabase
        .from('scores')
        .select('round_player_id, hole_number, strokes, pickup')
        .eq('round_id', game.round_id),
      supabase.from('game_players').select('round_player_id').eq('game_id', gameId),
      supabase
        .from('game_teams')
        .select('id, team_name, team_order, game_players(round_player_id)')
        .eq('game_id', gameId)
        .order('team_order'),
    ]);

  const nameByRp = new Map<string, string>();
  const chByRp = new Map<string, number | null>();
  const teeByRp = new Map<string, string>();
  const phByRp = new Map<string, number>();
  for (const rp of (rps ?? []) as any[]) {
    nameByRp.set(rp.id, rp.profiles?.display_name ?? rp.guest_name ?? 'Guest');
    chByRp.set(rp.id, rp.course_handicap ?? null);
    if (rp.tee_box_id) teeByRp.set(rp.id, rp.tee_box_id);
    phByRp.set(rp.id, rp.playing_handicap ?? rp.course_handicap ?? 0);
  }

  // Gross + net (total) per round_player from posted scores.
  const grossByRp = new Map<string, number>();
  const playedByRp = new Map<string, number>();
  for (const s of scoreRows ?? []) {
    if (s.strokes == null || !s.round_player_id) continue;
    const rpId = s.round_player_id;
    grossByRp.set(rpId, (grossByRp.get(rpId) ?? 0) + s.strokes);
    playedByRp.set(rpId, (playedByRp.get(rpId) ?? 0) + 1);
  }

  const gamePlayerIds = (gps ?? []).map((g: any) => g.round_player_id).filter(Boolean);
  const payout = ((game.config as any)?.payout ?? null) as PayoutConfig | null;
  // A random-teams best-ball game is a team game even before teams are drawn
  // (so we show the draw control, not an individual leaderboard).
  const hasTeams = (teamRows ?? []).length > 0;
  const isTeam = game.format === 'best_ball_2' && (hasTeams || isRandomTeams);
  const isSkins = game.format === 'skins';

  const buyIn = payout?.buyIn ?? game.money_per_unit ?? 0;

  // ---- Team standings (best ball) -------------------------------------
  let teamStandings: {
    key: string;
    label: string;
    members: string;
    toPar: number | null;
    payoutAmt: number;
    position: number;
  }[] = [];

  // ---- Individual standings -------------------------------------------
  let indivStandings: {
    key: string;
    name: string;
    hcp: number | null;
    gross: number;
    net: number | null;
    position: number;
    payoutAmt: number;
  }[] = [];

  // ---- Skins standings (pot split by skins won) -----------------------
  let skinsStandings: {
    key: string;
    name: string;
    skins: number;
    payoutAmt: number;
    position: number;
    holesLabel: string; // e.g. "birdie on 4, 9 · eagle on 5"
  }[] = [];
  let skinsPerSkin = 0;
  let skinsTotal = 0;
  let skinsBirdiesOnly = false;

  let pot = 0;

  if (isTeam) {
    // Load holes for the engine.
    const teeIds = [...new Set([...teeByRp.values()])];
    const { data: holeRows } = teeIds.length
      ? await supabase
          .from('holes')
          .select('hole_number, par, handicap_index, yardage, tee_box_id')
          .in('tee_box_id', teeIds)
      : { data: [] };
    const holesByTeeBox: Record<string, any[]> = {};
    for (const h of holeRows ?? []) {
      (holesByTeeBox[h.tee_box_id] ??= []).push({
        number: h.hole_number,
        par: h.par,
        strokeIndex: h.handicap_index,
        yardage: h.yardage ?? 0,
      });
    }
    const defaultHoles = Object.values(holesByTeeBox)[0] ?? [];

    const teams = (teamRows ?? []).map((t: any) => ({
      teamId: t.id,
      teamName: t.team_name,
      teamOrder: t.team_order ?? 0,
      playerIds: (t.game_players ?? []).map((gp: any) => gp.round_player_id),
    }));
    const antes = new Set(teams.flatMap((t) => t.playerIds)).size;
    pot = buyIn * antes;

    const scoreData = assembleBestBallScoreData({
      players: (rps ?? []).map((rp: any) => ({
        playerId: rp.id,
        displayName: nameByRp.get(rp.id) ?? 'Guest',
        playingHandicap: phByRp.get(rp.id) ?? 0,
        teeBoxId: rp.tee_box_id ?? '',
      })),
      holesByTeeBox,
      defaultHoles,
      scores: (scoreRows ?? []).map((s: any) => ({
        playerId: s.round_player_id,
        holeNumber: s.hole_number,
        strokes: s.strokes,
        pickup: s.pickup ?? false,
      })),
      teams,
      handicapAllowance:
        typeof (game.config as any)?.handicapAllowance === 'number'
          ? (game.config as any).handicapAllowance
          : 0.9,
    });

    const result = gameFormatRegistry
      .getEngine('best_ball_2')
      .calculateResults(scoreData, { useNet: true, countBest: 1 }, gameId);

    const paid = payout
      ? computePayouts(
          result.teamStandings.map((t) => ({ id: t.teamId, position: t.position })),
          payout,
          antes
        )
      : [];
    const payByTeam = new Map(paid.map((p) => [p.id, p.amount]));

    teamStandings = result.teamStandings.map((t) => ({
      key: t.teamId,
      label: t.teamName,
      members: (teams.find((x) => x.teamId === t.teamId)?.playerIds ?? [])
        .map((pid: string) => nameByRp.get(pid) ?? 'Player')
        .join(' & '),
      toPar: (t.metadata?.scoreToPar as number | undefined) ?? null,
      payoutAmt: payByTeam.get(t.teamId) ?? 0,
      position: t.position,
    }));
  } else if (isSkins) {
    // Skins: run the engine to get skins won per player (with carryover), then
    // split the pot by the TOTAL skins won — value/skin = pot ÷ total skins,
    // each player gets (their skins × value/skin). NOT winner-takes-all.
    pot = buyIn * gamePlayerIds.length;
    const teeIds = [...new Set([...teeByRp.values()])];
    const { data: holeRows } = teeIds.length
      ? await supabase
          .from('holes')
          .select('hole_number, par, handicap_index, yardage, tee_box_id')
          .in('tee_box_id', teeIds)
      : { data: [] };
    const byTee: Record<string, any[]> = {};
    for (const h of holeRows ?? []) {
      (byTee[h.tee_box_id] ??= []).push({
        holeNumber: h.hole_number,
        par: h.par,
        yardage: h.yardage ?? 0,
        handicapIndex: h.handicap_index,
      });
    }
    const holes = (Object.values(byTee)[0] ?? []).sort(
      (a: any, b: any) => a.holeNumber - b.holeNumber
    );

    const gpSet = new Set(gamePlayerIds);
    const cfg = (game.config as any) ?? {};
    skinsBirdiesOnly = cfg.birdiesOnly === true;
    const result = gameFormatRegistry.getEngine('skins').calculateResults(
      {
        holes,
        players: gamePlayerIds.map((rpId: string) => ({
          playerId: rpId,
          displayName: nameByRp.get(rpId) ?? 'Guest',
          playingHandicap: phByRp.get(rpId) ?? 0,
        })),
        scores: (scoreRows ?? [])
          .filter((s: any) => s.round_player_id && gpSet.has(s.round_player_id))
          .map((s: any) => ({
            playerId: s.round_player_id,
            holeNumber: s.hole_number,
            strokes: s.strokes,
          })),
        teams: [],
      },
      {
        // Accept both the canonical keys and the older UI keys.
        useNet: cfg.useNet ?? cfg.useHandicaps ?? true,
        carryOver: cfg.carryOver ?? cfg.carryover ?? true,
        birdiesOnly: skinsBirdiesOnly,
      },
      gameId
    );

    const skinVal = new Map<string, number>();
    for (const st of result.playerStandings) {
      skinVal.set(st.playerId, (st.metadata?.totalSkinsValue as number) ?? 0);
    }
    skinsTotal = [...skinVal.values()].reduce((a, b) => a + b, 0);
    skinsPerSkin = skinsTotal > 0 ? pot / skinsTotal : 0;

    // Which holes each player won, labelled by score type (birdie/eagle/…). The
    // engine's skinDetails carries the (net or gross) winning score per hole.
    const parByHole = new Map<number, number>(
      (holes as any[]).map((h) => [h.holeNumber, h.par])
    );
    const wonByPlayer = new Map<string, { hole: number; diff: number }[]>();
    for (const d of ((result.details as any)?.skinDetails ?? []) as any[]) {
      if (!d.winnerId) continue;
      const sc = d.scores?.[d.winnerId];
      const par = parByHole.get(d.holeNumber) ?? 0;
      const diff = typeof sc === 'number' && par ? sc - par : 0;
      const arr = wonByPlayer.get(d.winnerId) ?? [];
      arr.push({ hole: d.holeNumber, diff });
      wonByPlayer.set(d.winnerId, arr);
    }
    const scoreTypeName = (diff: number) =>
      diff <= -3 ? 'albatross'
        : diff === -2 ? 'eagle'
          : diff === -1 ? 'birdie'
            : diff === 0 ? 'par'
              : diff === 1 ? 'bogey'
                : `+${diff}`;
    const holesLabelFor = (rpId: string): string => {
      const won = (wonByPlayer.get(rpId) ?? []).sort((a, b) => a.hole - b.hole);
      if (!won.length) return '';
      const groups = new Map<string, number[]>();
      for (const w of won) {
        const t = scoreTypeName(w.diff);
        (groups.get(t) ?? groups.set(t, []).get(t)!).push(w.hole);
      }
      const order = ['albatross', 'eagle', 'birdie', 'par', 'bogey'];
      const keys = [...groups.keys()].sort(
        (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
      );
      return keys.map((t) => `${t} on ${groups.get(t)!.join(', ')}`).join(' · ');
    };

    skinsStandings = gamePlayerIds
      .map((rpId: string) => {
        const skins = skinVal.get(rpId) ?? 0;
        return {
          key: rpId,
          name: nameByRp.get(rpId) ?? 'Guest',
          skins,
          payoutAmt: Math.round(skins * skinsPerSkin * 100) / 100,
          holesLabel: holesLabelFor(rpId),
        };
      })
      .sort((a, b) => b.skins - a.skins)
      .map((r, i) => ({ ...r, position: i + 1 }));
  } else {
    // Individual: rank by net total (gross − course handicap).
    pot = buyIn * gamePlayerIds.length;
    const rows = gamePlayerIds.map((rpId: string) => {
      const played = playedByRp.get(rpId) ?? 0;
      const gross = grossByRp.get(rpId) ?? 0;
      const ch = chByRp.get(rpId) ?? null;
      return {
        key: rpId,
        name: nameByRp.get(rpId) ?? 'Guest',
        hcp: ch,
        gross,
        played,
        net: played > 0 ? gross - (ch ?? 0) : null,
      };
    });
    // Started first (by net), then not-started.
    rows.sort((a, b) => {
      const as = a.played > 0 ? 0 : 1;
      const bs = b.played > 0 ? 0 : 1;
      if (as !== bs) return as - bs;
      if (as === 0) return (a.net ?? 0) - (b.net ?? 0);
      return a.name.localeCompare(b.name);
    });
    // Positions with ties on net (only among started).
    const ranked = rows.map((r, i) => {
      let position = i + 1;
      if (r.played > 0 && i > 0 && rows[i - 1].played > 0 && rows[i - 1].net === r.net) {
        // tie — same as previous (recompute below)
      }
      return { ...r, position };
    });
    // Fix tie positions.
    let pos = 1;
    for (let i = 0; i < ranked.length; i++) {
      if (ranked[i].played === 0) {
        ranked[i].position = pos;
      } else if (i > 0 && ranked[i - 1].played > 0 && ranked[i - 1].net === ranked[i].net) {
        ranked[i].position = ranked[i - 1].position;
      } else {
        ranked[i].position = pos;
      }
      pos++;
    }

    const paid = payout
      ? computePayouts(
          ranked
            .filter((r) => r.played > 0)
            .map((r) => ({ id: r.key, position: r.position })),
          payout,
          gamePlayerIds.length
        )
      : [];
    const payByPlayer = new Map(paid.map((p) => [p.id, p.amount]));

    indivStandings = ranked.map((r) => ({
      key: r.key,
      name: r.name,
      hcp: r.hcp,
      gross: r.gross,
      net: r.net,
      position: r.position,
      payoutAmt: payByPlayer.get(r.key) ?? 0,
    }));
  }

  const label = GAME_LABELS[game.format] ?? game.name ?? game.format;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/rounds/${roundId}/games`}
            className="text-sm text-surface-300 hover:text-surface-100 mb-1 inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Games
          </Link>
          <h1 className="text-2xl font-bold text-surface-50">{game.name || label}</h1>
        </div>
        <Badge variant={game.status === 'finalized' ? 'default' : 'secondary'}>
          {game.status === 'finalized' ? 'Final' : 'Live'}
        </Badge>
      </div>

      {(buyIn > 0 || payout) && (
        <Card>
          <div className="p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-surface-300 uppercase tracking-wide">Type</p>
              <p className="text-sm font-semibold text-surface-50 mt-1">{label}</p>
            </div>
            <div>
              <p className="text-xs text-surface-300 uppercase tracking-wide">Buy-in</p>
              <p className="text-sm font-semibold text-surface-50 mt-1">
                {buyIn > 0 ? `$${buyIn}` : 'Free'}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-300 uppercase tracking-wide">Pot</p>
              <p className="text-sm font-semibold text-golf-500 mt-1">
                {pot > 0 ? `$${pot}` : '-'}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Standings</CardTitle>
          <CardDescription>
            {game.status === 'finalized' ? 'Final results' : 'Live — updates as scores come in'}
          </CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          {isTeam ? (
            <div className="space-y-3">
              {isRandomTeams && (
                <RandomTeamsControl
                  gameId={gameId}
                  playerCount={gamePlayerIds.length}
                  hasTeams={hasTeams}
                  canManage={canManage}
                  finalized={game.status === 'finalized'}
                />
              )}
              {teamStandings.length === 0 ? (
                !isRandomTeams ? (
                  <p className="text-sm text-surface-300 py-4">Teams haven&apos;t been drawn yet.</p>
                ) : null
              ) : (
                <div className="space-y-1.5">
                {teamStandings.map((t) => (
                  <div
                    key={t.key}
                    className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                      t.position === 1
                        ? 'bg-gold-500/10 border-gold-500/30'
                        : 'bg-surface-900/40 border-surface-700'
                    }`}
                  >
                    <span className="w-6 text-sm font-bold text-surface-200">{t.position}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-50 truncate">{t.members}</p>
                      <p className="text-[11px] text-surface-400">{t.label}</p>
                    </div>
                    {t.toPar !== null && (
                      <span className="text-sm font-bold tabular-nums text-surface-100">
                        {t.toPar === 0 ? 'E' : t.toPar > 0 ? `+${t.toPar}` : t.toPar}
                      </span>
                    )}
                    {t.payoutAmt > 0 && (
                      <span className="w-14 text-right text-sm font-bold text-golf-500 tabular-nums">
                        +${t.payoutAmt}
                      </span>
                    )}
                  </div>
                ))}
                </div>
              )}
            </div>
          ) : isSkins ? (
            skinsStandings.length === 0 ? (
              <p className="text-sm text-surface-300 py-4">No players in this game.</p>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                  <span className="w-6" />
                  <span className="flex-1">Player</span>
                  <span className="w-16 text-right">Skins</span>
                  <span className="w-14 text-right" />
                </div>
                {skinsStandings.map((p) => (
                  <div
                    key={p.key}
                    className={`rounded-lg p-2.5 ${
                      p.position === 1 && p.skins > 0
                        ? 'bg-gold-500/10 border border-gold-500/30'
                        : 'hover:bg-surface-700/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-sm font-bold text-surface-200">
                        {p.skins > 0 ? p.position : '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-50 truncate">{p.name}</p>
                      </div>
                      <span className="w-16 text-right text-sm font-bold tabular-nums text-surface-50">
                        {p.skins}
                      </span>
                      <span className="w-14 text-right text-sm font-bold text-golf-500 tabular-nums">
                        {p.payoutAmt > 0 ? `+$${p.payoutAmt}` : ''}
                      </span>
                    </div>
                    {p.holesLabel && (
                      <p className="mt-1 pl-8 text-[11px] text-surface-300">{p.holesLabel}</p>
                    )}
                  </div>
                ))}
                {skinsBirdiesOnly && (
                  <p className="pt-2 px-2 text-[11px] text-surface-400">
                    Skins awarded on a birdie or better only.
                  </p>
                )}
                {skinsPerSkin > 0 && (
                  <p className="px-2 text-[11px] text-surface-400">
                    Pot ${pot} ÷ {skinsTotal} skins = ${Math.round(skinsPerSkin * 100) / 100}/skin
                  </p>
                )}
              </div>
            )
          ) : indivStandings.length === 0 ? (
            <p className="text-sm text-surface-300 py-4">No players in this game.</p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                <span className="w-6" />
                <span className="flex-1">Player</span>
                <span className="w-12 text-right">Gross</span>
                <span className="w-12 text-right">Net</span>
                <span className="w-14 text-right" />
              </div>
              {indivStandings.map((p) => (
                <div
                  key={p.key}
                  className={`flex items-center gap-2 rounded-lg p-2.5 ${
                    p.position === 1 && p.net !== null
                      ? 'bg-gold-500/10 border border-gold-500/30'
                      : 'hover:bg-surface-700/40'
                  }`}
                >
                  <span className="w-6 text-sm font-bold text-surface-200">
                    {p.net === null ? '—' : p.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-50 truncate">{p.name}</p>
                    {p.hcp !== null && (
                      <p className="text-[11px] text-surface-400">CH {p.hcp}</p>
                    )}
                  </div>
                  <span className="w-12 text-right text-sm tabular-nums text-surface-100">
                    {p.gross || '-'}
                  </span>
                  <span className="w-12 text-right text-sm font-bold tabular-nums text-surface-50">
                    {p.net ?? '-'}
                  </span>
                  <span className="w-14 text-right text-sm font-bold text-golf-500 tabular-nums">
                    {p.payoutAmt > 0 ? `+$${p.payoutAmt}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="flex gap-3">
        <Link href={`/rounds/${roundId}`} className="flex-1">
          <Button variant="outline" className="w-full">Round</Button>
        </Link>
        <Link href={`/rounds/${roundId}/games`} className="flex-1">
          <Button variant="outline" className="w-full">All Games</Button>
        </Link>
      </div>
    </div>
  );
}
