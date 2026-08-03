import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { featureFlags } from '@/lib/feature-flags';
import PlayView from './play-view';
import type {
  PlayRound,
  PlayScore,
  PlayHole,
  PlayPlayer,
  PlayTeeGroup,
  BestBallGame,
  BestBallTeam,
} from '@/components/play/shared';

interface PlayPageProps {
  params: Promise<{ roundId: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  if (!featureFlags.playExperience) notFound();

  const { roundId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: roundData, error: roundError } = await supabase
    .from('rounds')
    .select(
      `
      id,
      course_id,
      group_id,
      status,
      round_date,
      created_by,
      confirmed_at,
      scoring_mode,
      scorekeeper_id,
      courses ( id, name ),
      round_players (
        id,
        user_id,
        tee_box_id,
        tee_time_group_id,
        playing_handicap,
        guest_name,
        guest_handicap_index,
        confirmed_at,
        profiles:profiles!round_players_user_id_fkey (
          id,
          display_name,
          current_handicap_index
        )
      )
    `
    )
    .eq('id', roundId)
    .single();

  if (roundError || !roundData) {
    notFound();
  }

  // Holes for every tee box in play (each player scores against their own pars)
  const uniqueTeeBoxIds = [
    ...new Set(
      roundData.round_players
        .map((rp: any) => rp.tee_box_id)
        .filter(Boolean)
    ),
  ];

  const { data: allHolesData } =
    uniqueTeeBoxIds.length > 0
      ? await supabase
          .from('holes')
          .select('hole_number, par, handicap_index, yardage, tee_box_id')
          .in('tee_box_id', uniqueTeeBoxIds)
          .order('hole_number')
      : { data: [] };

  const holesByTeeBox: Record<string, PlayHole[]> = {};
  for (const h of allHolesData ?? []) {
    (holesByTeeBox[h.tee_box_id] ??= []).push({
      number: h.hole_number,
      par: h.par,
      strokeIndex: h.handicap_index,
      yardage: h.yardage ?? 0,
    });
  }
  const defaultHoles = Object.values(holesByTeeBox)[0] ?? [];

  // Tee-time groups (flights) with designated scorer
  const { data: teeGroupData } = await supabase
    .from('tee_time_groups')
    .select('id, name, tee_time, sort_order, scorer_id')
    .eq('round_id', roundId)
    .order('sort_order');

  const teeGroups: PlayTeeGroup[] = (teeGroupData ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    teeTime: g.tee_time,
    sortOrder: g.sort_order,
    scorerId: g.scorer_id ?? null,
  }));

  // Leaderboard basis from games config. The engine stores `useNet` per game;
  // default to net (amateur play) unless every game is explicitly gross.
  const { data: gamesData } = await supabase
    .from('games')
    .select('id, format, config, status')
    .eq('round_id', roundId);
  const anyNet = (gamesData ?? []).some(
    (g: any) => (g?.config?.useNet ?? true) !== false
  );
  const scoring: 'gross' | 'net' =
    gamesData && gamesData.length > 0 && !anyNet ? 'gross' : 'net';

  // Existing scores (all stat columns)
  const { data: scoresData } = await supabase
    .from('scores')
    .select(
      'player_id, round_player_id, hole_number, strokes, pickup, putts, fairway_hit, fairway_miss, gir, green_miss, fairway_bunker, greenside_bunker, penalties, up_and_down'
    )
    .eq('round_id', roundId);

  const rpIdToPlayerId = new Map<string, string>();
  for (const rp of roundData.round_players as any[]) {
    rpIdToPlayerId.set(rp.id, rp.user_id || rp.id);
  }

  const initialScores: PlayScore[] = (scoresData ?? []).map((s: any) => ({
    playerId:
      s.player_id ?? rpIdToPlayerId.get(s.round_player_id) ?? s.round_player_id,
    holeNumber: s.hole_number,
    strokes: s.strokes,
    pickup: s.pickup ?? false,
    putts: s.putts ?? null,
    fairwayHit: s.fairway_hit ?? null,
    fairwayMiss: s.fairway_miss ?? null,
    gir: s.gir ?? null,
    greenMiss: s.green_miss ?? null,
    fairwayBunker: s.fairway_bunker ?? null,
    greensideBunker: s.greenside_bunker ?? null,
    penalties: s.penalties ?? null,
    upAndDown: s.up_and_down ?? null,
  }));

  const currentUserRoundPlayer = roundData.round_players.find(
    (rp: any) => rp.user_id === user?.id
  );
  const currentUserGroupId =
    (currentUserRoundPlayer as any)?.tee_time_group_id ?? null;

  const players: PlayPlayer[] = roundData.round_players.map((rp: any) => {
    const isGuest = !rp.user_id;
    // rp.profiles can be null even for a member: profiles RLS may hide a
    // round-mate you don't share a group with (Game Time / roster rounds).
    // Never deref it directly. id keys off user_id (== profiles.id) for
    // members, round_players.id for guests.
    const prof = rp.profiles;
    return {
      id: rp.user_id ?? rp.id,
      roundPlayerId: rp.id,
      displayName: (isGuest ? rp.guest_name : prof?.display_name) ?? rp.guest_name ?? 'Player',
      handicap: isGuest
        ? rp.guest_handicap_index
        : prof?.current_handicap_index ?? null,
      playingHandicap: rp.playing_handicap ?? 0,
      teeBoxId: rp.tee_box_id,
      teeTimeGroupId: rp.tee_time_group_id ?? null,
      isGuest,
      confirmed: !!rp.confirmed_at,
    };
  });

  // The "2-Man Best Ball — Random Teams" game (if the Commish added one), with
  // its drawn teams. Members map back into the PlayPlayer.id space.
  const bbGameRow = (gamesData ?? []).find(
    (g: any) => g.format === 'best_ball_2' && g?.config?.randomTeams === true
  );
  let bestBall: BestBallGame | null = null;
  if (bbGameRow) {
    const { data: teamRows } = await supabase
      .from('game_teams')
      .select('id, team_name, team_order, game_players ( player_id, round_player_id )')
      .eq('game_id', (bbGameRow as any).id)
      .order('team_order');
    const teams: BestBallTeam[] = (teamRows ?? []).map((t: any) => ({
      teamId: t.id,
      teamName: t.team_name,
      teamOrder: t.team_order ?? 0,
      playerIds: (t.game_players ?? []).map(
        (gp: any) =>
          gp.player_id ?? rpIdToPlayerId.get(gp.round_player_id) ?? gp.round_player_id
      ),
    }));
    const cfg = ((bbGameRow as any).config ?? {}) as Record<string, any>;
    bestBall = {
      gameId: (bbGameRow as any).id,
      status: (bbGameRow as any).status,
      payout: (cfg.payout as BestBallGame['payout']) ?? null,
      handicapAllowance:
        typeof cfg.handicapAllowance === 'number' ? cfg.handicapAllowance : 0.9,
      teams,
    };
  }

  // An individual Low Net game, if one was added (payouts computed from the net
  // leaderboard on the client).
  const lnGameRow = (gamesData ?? []).find((g: any) => g.format === 'low_net');
  const lowNet: PlayRound['lowNet'] = lnGameRow
    ? {
        gameId: (lnGameRow as any).id,
        payout: (((lnGameRow as any).config ?? {}).payout ?? null),
      }
    : null;

  // Who may draw/redraw teams — mirror can_finalize_round (creator, scorekeeper,
  // or group admin). The RPC is authoritative; this just gates button visibility.
  let isGroupAdmin = false;
  if (user && (roundData as any).group_id) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', (roundData as any).group_id)
      .eq('user_id', user.id)
      .maybeSingle();
    isGroupAdmin = membership?.role === 'admin';
  }
  const canGenerateTeams =
    !!user &&
    ((roundData as any).created_by === user.id ||
      (roundData as any).scorekeeper_id === user.id ||
      isGroupAdmin);

  const round: PlayRound = {
    id: roundData.id,
    courseName: (roundData.courses as any)?.name ?? 'Unknown Course',
    status: roundData.status as PlayRound['status'],
    date: roundData.round_date,
    players,
    holesByTeeBox,
    defaultHoles,
    teeGroups,
    currentUserId: user?.id ?? null,
    currentUserGroupId,
    scoring,
    isCommish: !!user && (roundData as any).created_by === user.id,
    confirmed: !!(roundData as any).confirmed_at,
    scoringMode: (roundData as any).scoring_mode ?? null,
    scorekeeperId: (roundData as any).scorekeeper_id ?? null,
    bestBall,
    canGenerateTeams,
    lowNet,
  };

  return <PlayView round={round} initialScores={initialScores} />;
}
