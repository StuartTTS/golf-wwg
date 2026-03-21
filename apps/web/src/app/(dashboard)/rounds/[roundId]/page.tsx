import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
} from '@/components/ui';
import { AddGuestForm } from '@/components/rounds/add-guest-form';
import { RegistrationCard } from '@/components/rounds/registration-card';
import TeeAssignmentCard from '@/components/rounds/tee-assignment-card';
import TeeTimeGroupManager from '@/components/rounds/tee-time-group-manager';

interface RoundPageProps {
  params: Promise<{ roundId: string }>;
}

export default async function RoundDashboardPage({ params }: RoundPageProps) {
  const { roundId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch round with course, tee box, and group info
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select(`
      id,
      round_date,
      tee_time,
      status,
      scoring_mode,
      created_by,
      group_id,
      course_id,
      tee_box_id,
      registration_status,
      course:courses (id, name),
      tee_box:tee_boxes (id, name, color, course_rating, slope_rating),
      group:groups (id, name)
    `)
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    notFound();
  }

  // Fetch players with profiles and tee box info
  const { data: players } = await supabase
    .from('round_players')
    .select(`
      id,
      user_id,
      tee_box_id,
      tee_time_group_id,
      status,
      handicap_index_at_round,
      course_handicap,
      guest_name,
      guest_handicap_index,
      profile:profiles (id, display_name, current_handicap_index),
      tee_box:tee_boxes (id, name, color)
    `)
    .eq('round_id', roundId)
    .order('status', { ascending: true });

  // Fetch games for this round
  const { data: games } = await supabase
    .from('games')
    .select(`
      id,
      format,
      name,
      status,
      money_per_unit,
      holes
    `)
    .eq('round_id', roundId)
    .order('created_at', { ascending: true });

  // Fetch tee time groups
  const { data: teeTimeGroups } = await supabase
    .from('tee_time_groups')
    .select('id, name, tee_time, sort_order')
    .eq('round_id', roundId)
    .order('sort_order');

  // Build player-to-group map from round_players
  const playerGroupMap: Record<string, string> = {};
  players?.forEach((p) => {
    const pid = p.user_id || p.id; // user_id for members, id for guests
    if (p.tee_time_group_id) {
      playerGroupMap[pid] = p.tee_time_group_id;
    }
  });

  // Check if current user is group admin
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

  // Fetch round invitations
  const { data: roundInvitations } = await supabase
    .from('invitations')
    .select('email, status')
    .eq('round_id', roundId)
    .eq('type', 'round');

  const invitedEmails = (roundInvitations ?? []).map(inv => inv.email);
  const { data: invitedProfiles } = invitedEmails.length > 0
    ? await supabase
        .from('profiles')
        .select('id, display_name, email, current_handicap_index')
        .in('email', invitedEmails)
    : { data: [] as any[] };

  // Fetch all group members for registration card
  const { data: allGroupMembers } = await supabase
    .from('group_members')
    .select('user_id, profiles:profiles(id, display_name, email, current_handicap_index, default_tee_tier)')
    .eq('group_id', round.group_id);

  // Build available members list (not in round and not invited)
  const roundPlayerUserIds = new Set(
    (players ?? []).map(rp => rp.user_id).filter((id): id is string => id !== null)
  );
  const invitedEmailSet = new Set(invitedEmails);

  const availableMembers = (allGroupMembers ?? [])
    .filter(gm => {
      if (roundPlayerUserIds.has(gm.user_id)) return false;
      const profile = gm.profiles as any;
      if (profile?.email && invitedEmailSet.has(profile.email)) return false;
      return true;
    })
    .map(gm => {
      const profile = gm.profiles as any;
      return {
        userId: gm.user_id,
        displayName: profile?.display_name ?? 'Unknown',
        handicapIndex: profile?.current_handicap_index ?? null,
        defaultTeeTier: profile?.default_tee_tier ?? null,
      };
    });

  // Fetch course tee boxes for tee assignment card
  const { data: courseTeeBoxes } = await supabase
    .from('tee_boxes')
    .select('id, name, color, course_rating, slope_rating, tier')
    .eq('course_id', round.course_id)
    .order('tier', { ascending: true, nullsFirst: false });

  // Build props for Registration Card
  const registeredPlayersList = (players ?? [])
    .filter(rp => ['registered', 'confirmed', 'playing'].includes(rp.status))
    .map(rp => ({
      id: rp.id,
      displayName: rp.user_id
        ? (rp as any).profile?.display_name ?? 'Unknown'
        : rp.guest_name ?? 'Guest',
      status: rp.status,
      handicapIndex: rp.handicap_index_at_round ?? rp.guest_handicap_index ?? null,
      isGuest: !rp.user_id,
    }));

  const invitedPlayersList = (roundInvitations ?? [])
    .filter(inv => ['pending', 'declined'].includes(inv.status))
    .map(inv => {
      const profile = (invitedProfiles ?? []).find((p: any) => p.email === inv.email);
      return {
        email: inv.email,
        status: inv.status,
        displayName: profile?.display_name ?? null,
        handicapIndex: profile?.current_handicap_index ?? null,
        userId: profile?.id ?? null,
      };
    });

  // Build props for Tee Assignment Card
  const playerTeesData = (players ?? [])
    .filter(rp => ['registered', 'confirmed', 'playing'].includes(rp.status))
    .map(rp => {
      const memberData = (allGroupMembers ?? []).find(gm => gm.user_id === rp.user_id);
      const memberProfile = memberData?.profiles as any;
      return {
        roundPlayerId: rp.id,
        displayName: rp.user_id
          ? (rp as any).profile?.display_name ?? 'Unknown'
          : rp.guest_name ?? 'Guest',
        teeBoxId: rp.tee_box_id,
        isGuest: !rp.user_id,
        defaultTeeTier: memberProfile?.default_tee_tier ?? null,
      };
    });

  // Build props for TeeTimeGroupManager
  const groupManagerPlayers = (players ?? [])
    .filter(rp => ['registered', 'confirmed', 'playing'].includes(rp.status))
    .map(rp => ({
      id: rp.user_id ?? rp.id,
      displayName: rp.user_id
        ? (rp as any).profile?.display_name ?? 'Unknown'
        : rp.guest_name ?? 'Guest',
      isGuest: !rp.user_id,
      courseHandicap: rp.course_handicap ?? null,
      handicapIndex: rp.handicap_index_at_round ?? rp.guest_handicap_index ?? null,
    }));

  // Fetch scores for leaderboard (only if round has started)
  let leaderboard: { userId: string; name: string; totalStrokes: number; holesPlayed: number; totalPar: number }[] = [];

  if (round.status === 'in_progress' || round.status === 'completed') {
    const { data: scores } = await supabase
      .from('scores')
      .select('player_id, round_player_id, hole_number, strokes')
      .eq('round_id', roundId)
      .not('strokes', 'is', null);

    // Fetch hole pars for ALL tee boxes used by players
    const uniqueTeeBoxIds = [...new Set(players?.map(p => p.tee_box_id).filter(Boolean) ?? [])];

    const { data: allHoles } = uniqueTeeBoxIds.length > 0
      ? await supabase
          .from('holes')
          .select('hole_number, par, tee_box_id')
          .in('tee_box_id', uniqueTeeBoxIds)
      : { data: null };

    const parMaps = new Map<string, Map<number, number>>();
    allHoles?.forEach((h) => {
      if (!parMaps.has(h.tee_box_id)) parMaps.set(h.tee_box_id, new Map());
      parMaps.get(h.tee_box_id)!.set(h.hole_number, h.par);
    });

    // Map each player to their tee box (user_id for members, id for guests)
    const playerTeeMap = new Map<string, string>();
    players?.forEach(p => {
      const pid = p.user_id || p.id;
      playerTeeMap.set(pid, p.tee_box_id);
    });

    if (scores && scores.length > 0 && players) {
      const playerScores = new Map<string, { strokes: number; holesPlayed: number; totalPar: number }>();

      for (const score of scores) {
        const pid = score.player_id ?? score.round_player_id ?? '';
        const existing = playerScores.get(pid) ?? { strokes: 0, holesPlayed: 0, totalPar: 0 };
        existing.strokes += score.strokes!;
        existing.holesPlayed += 1;
        const playerTeeBoxId = playerTeeMap.get(pid) ?? '';
        existing.totalPar += parMaps.get(playerTeeBoxId)?.get(score.hole_number) ?? 0;
        playerScores.set(pid, existing);
      }

      leaderboard = players
        .filter((p) => p.user_id && playerScores.has(p.user_id))
        .map((p) => {
          const stats = playerScores.get(p.user_id!)!;
          return {
            userId: p.user_id!,
            name: (p.profile as any)?.display_name ?? p.guest_name ?? 'Unknown',
            totalStrokes: stats.strokes,
            holesPlayed: stats.holesPlayed,
            totalPar: stats.totalPar,
          };
        })
        .sort((a, b) => (a.totalStrokes - a.totalPar) - (b.totalStrokes - b.totalPar));
    }
  }

  // Permissions
  const isCreator = round.created_by === user?.id;
  const isPlayer = players?.some((p) => p.user_id === user?.id);

  // Game type labels
  const GAME_LABELS: Record<string, string> = {
    nassau: 'Nassau',
    skins: 'Skins',
    wolf: 'Wolf',
    best_ball: 'Best Ball',
    progressive_best_ball: 'Progressive Best Ball',
    stableford: 'Stableford',
    match_play: 'Match Play',
    bingo_bango_bongo: 'Bingo Bango Bongo',
  };

  const formatToPar = (strokes: number, par: number) => {
    const diff = strokes - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        {round.group && (
          <Link
            href={`/groups/${(round.group as any).id}`}
            className="text-sm text-surface-300 hover:text-surface-100 mb-2 inline-block"
          >
            &larr; Back to {(round.group as any).name}
          </Link>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-surface-50">
              {(round.course as any)?.name ?? 'Unknown Course'}
            </h1>
            <p className="mt-1 text-sm text-surface-300">
              {new Date(round.round_date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              {round.tee_time && ` at ${round.tee_time}`}
            </p>
          </div>
          <Badge
            variant={
              round.status === 'completed'
                ? 'default'
                : round.status === 'in_progress'
                  ? 'secondary'
                  : 'outline'
            }
            className="capitalize text-sm"
          >
            {round.status.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {round.status === 'upcoming' && (
          <>
            <Link href={`/rounds/${roundId}/scorecard`}>
              <Button>Enter Scorecard</Button>
            </Link>
            <Link href={`/rounds/${roundId}/games`}>
              <Button variant="outline">Set Up Games</Button>
            </Link>
          </>
        )}
        {round.status === 'in_progress' && (
          <>
            <Link href={`/rounds/${roundId}/scorecard`}>
              <Button>Enter Scores</Button>
            </Link>
            <Link href={`/rounds/${roundId}/games`}>
              <Button variant="outline">Games</Button>
            </Link>
          </>
        )}
        {round.status === 'completed' && (
          <>
            <Link href={`/rounds/${roundId}/results`}>
              <Button>View Results</Button>
            </Link>
            <Link href={`/rounds/${roundId}/scorecard`}>
              <Button variant="outline">View Scorecard</Button>
            </Link>
            <Link href={`/rounds/${roundId}/games`}>
              <Button variant="outline">Games</Button>
            </Link>
          </>
        )}
      </div>

      {/* Round Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Round Details</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {(round.group as any)?.name && (
              <>
                <dt className="text-surface-400">Group</dt>
                <dd className="text-surface-50 font-medium">{(round.group as any).name}</dd>
              </>
            )}
            <dt className="text-surface-400">Course</dt>
            <dd className="text-surface-50 font-medium">{(round.course as any)?.name}</dd>
            {(round.tee_box as any)?.name && (
              <>
                <dt className="text-surface-400">Default Tees</dt>
                <dd className="text-surface-50 font-medium flex items-center gap-2">
                  {(round.tee_box as any).color && (
                    <span
                      className="w-3 h-3 rounded-full border border-surface-500 inline-block"
                      style={{ backgroundColor: (round.tee_box as any).color }}
                    />
                  )}
                  {(round.tee_box as any).name}
                  <span className="text-surface-400 font-normal">
                    ({(round.tee_box as any).course_rating} / {(round.tee_box as any).slope_rating})
                  </span>
                </dd>
              </>
            )}
            <dt className="text-surface-400">Players</dt>
            <dd className="text-surface-50 font-medium">{players?.length ?? 0}</dd>
            {games && games.length > 0 && (
              <>
                <dt className="text-surface-400">Games</dt>
                <dd className="text-surface-50 font-medium">{games.length}</dd>
              </>
            )}
          </dl>
        </div>
      </Card>

      {/* Admin Cards: Registration, Tee Assignments, Tee Time Groups */}
      {isGroupAdmin && (
        <div className="space-y-4">
          <RegistrationCard
            roundId={round.id}
            registrationStatus={round.registration_status}
            roundStatus={round.status}
            defaultTeeBoxId={round.tee_box_id}
            registeredPlayers={registeredPlayersList}
            invitedPlayers={invitedPlayersList}
            availableMembers={availableMembers}
            courseTeeBoxes={(courseTeeBoxes ?? []).map(tb => ({ id: tb.id, tier: tb.tier }))}
          />

          <TeeAssignmentCard
            roundId={round.id}
            roundStatus={round.status}
            defaultTeeBoxId={round.tee_box_id}
            teeBoxes={courseTeeBoxes ?? []}
            players={playerTeesData}
          />

          {round.status !== 'completed' && (
            <TeeTimeGroupManager
              roundId={round.id}
              players={groupManagerPlayers}
              existingGroups={teeTimeGroups ?? []}
              playerGroupMap={playerGroupMap}
            />
          )}
        </div>
      )}

      {/* Leaderboard (in_progress or completed) */}
      {leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leaderboard</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6">
            <div className="space-y-2">
              {leaderboard.map((entry, index) => {
                const toPar = entry.totalStrokes - entry.totalPar;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 ? 'bg-gold-500/10 border border-gold-500/30' : 'bg-surface-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${
                        index === 0
                          ? 'bg-gold-500 text-surface-900'
                          : index === 1
                            ? 'bg-surface-400 text-surface-900'
                            : index === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-surface-600 text-surface-200'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-surface-50">{entry.name}</p>
                        <p className="text-xs text-surface-400">
                          thru {entry.holesPlayed}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold tabular-nums text-surface-50">
                        {entry.totalStrokes}
                      </span>
                      <span className={`text-sm font-semibold tabular-nums min-w-[3ch] text-right ${
                        toPar < 0
                          ? 'text-red-400'
                          : toPar > 0
                            ? 'text-blue-400'
                            : 'text-surface-200'
                      }`}>
                        {formatToPar(entry.totalStrokes, entry.totalPar)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Players */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Players ({players?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          {!players || players.length === 0 ? (
            <p className="text-sm text-surface-300">No players registered yet.</p>
          ) : (
            <ul className="space-y-3">
              {players.map((player) => {
                const isGuest = !player.user_id;
                const displayName = isGuest
                  ? (player as any).guest_name ?? 'Guest'
                  : (player.profile as any)?.display_name ?? 'Unknown';

                return (
                  <li
                    key={player.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium ${
                        isGuest
                          ? 'bg-surface-600 text-surface-300'
                          : 'bg-emerald-900/40 text-golf-600'
                      }`}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-50 flex items-center gap-2">
                          {displayName}
                          {isGuest && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Guest
                            </Badge>
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          {(player.tee_box as any)?.name && (
                            <span className="flex items-center gap-1 text-xs text-surface-400">
                              {(player.tee_box as any).color && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-surface-500 inline-block"
                                  style={{ backgroundColor: (player.tee_box as any).color }}
                                />
                              )}
                              {(player.tee_box as any).name}
                            </span>
                          )}
                          {player.course_handicap != null && (
                            <span className="text-xs text-surface-400">
                              {(player.tee_box as any)?.name ? '· ' : ''}HCP {player.course_handicap}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        player.status === 'playing'
                          ? 'secondary'
                          : player.status === 'completed'
                            ? 'default'
                            : 'outline'
                      }
                      className="capitalize text-xs"
                    >
                      {player.status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          {/* Add Guest form - shown to round creator/admin when round is not completed */}
          {isCreator && round.status !== 'completed' && (
            <div className="mt-4">
              <AddGuestForm
                roundId={roundId}
                defaultTeeBoxId={(round.tee_box as any)?.id ?? ''}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Games */}
      {games && games.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Games</CardTitle>
              <Link href={`/rounds/${roundId}/games`}>
                <Button variant="outline" size="sm">Manage</Button>
              </Link>
            </div>
          </CardHeader>
          <div className="px-6 pb-6">
            <ul className="space-y-3">
              {games.map((game) => (
                <li key={game.id}>
                  <Link
                    href={`/rounds/${roundId}/games/${game.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-700 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-50">
                        {game.name || GAME_LABELS[game.format] || game.format}
                      </p>
                      <p className="text-xs text-surface-400">
                        {GAME_LABELS[game.format] || game.format}
                        {game.money_per_unit ? ` · $${game.money_per_unit}/unit` : ''}
                        {game.holes !== 'all' ? ` · ${game.holes}` : ''}
                      </p>
                    </div>
                    <Badge
                      variant={game.status === 'completed' ? 'default' : 'outline'}
                      className="capitalize text-xs"
                    >
                      {game.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* No games prompt */}
      {(!games || games.length === 0) && round.status !== 'completed' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Games</CardTitle>
              <CardDescription>
                Add side games like Nassau, Skins, or Wolf.
              </CardDescription>
            </div>
            <Link href={`/rounds/${roundId}/games`}>
              <Button variant="outline" size="sm">Add Game</Button>
            </Link>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
