import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ScorecardView from './scorecard-view';

interface ScorecardPageProps {
  params: Promise<{ roundId: string }>;
}

export default async function ScorecardPage({ params }: ScorecardPageProps) {
  const { roundId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: roundData, error: roundError } = await supabase
    .from('rounds')
    .select(`
      id,
      course_id,
      status,
      round_date,
      courses (
        id,
        name
      ),
      round_players (
        id,
        user_id,
        tee_box_id,
        tee_time_group_id,
        playing_handicap,
        guest_name,
        guest_handicap_index,
        profiles:profiles!round_players_user_id_fkey (
          id,
          display_name,
          current_handicap_index
        )
      )
    `)
    .eq('id', roundId)
    .single();

  if (roundError || !roundData) {
    notFound();
  }

  // Load holes for ALL unique tee boxes so each player gets correct pars
  const uniqueTeeBoxIds = [
    ...new Set(
      roundData.round_players
        .map((rp: any) => rp.tee_box_id)
        .filter(Boolean)
    ),
  ];

  const { data: allHolesData } = uniqueTeeBoxIds.length > 0
    ? await supabase
        .from('holes')
        .select('hole_number, par, handicap_index, yardage, tee_box_id')
        .in('tee_box_id', uniqueTeeBoxIds)
        .order('hole_number')
    : { data: [] };

  const holesByTeeBox: Record<
    string,
    { number: number; par: number; strokeIndex: number; yardage: number }[]
  > = {};
  for (const h of allHolesData ?? []) {
    if (!holesByTeeBox[h.tee_box_id]) holesByTeeBox[h.tee_box_id] = [];
    holesByTeeBox[h.tee_box_id].push({
      number: h.hole_number,
      par: h.par,
      strokeIndex: h.handicap_index,
      yardage: h.yardage ?? 0,
    });
  }

  const defaultHoles = Object.values(holesByTeeBox)[0] ?? [];

  // Determine current user's tee time group
  const currentUserRoundPlayer = roundData.round_players.find(
    (rp: any) => rp.user_id === user?.id
  );
  const currentUserGroupId = (currentUserRoundPlayer as any)?.tee_time_group_id ?? null;

  // Load existing scores for this round
  const { data: scoresData } = await supabase
    .from('scores')
    .select('player_id, round_player_id, hole_number, strokes, putts, fairway_hit, gir, up_and_down')
    .eq('round_id', roundId);

  // Build a map from round_player_id to the player id used in the UI
  // (user_id for members, round_players.id for guests)
  const rpIdToPlayerId = new Map<string, string>();
  for (const rp of roundData.round_players as any[]) {
    rpIdToPlayerId.set(rp.id, rp.user_id || rp.id);
  }

  const initialScores = (scoresData ?? []).map((s: any) => ({
    // For guests, player_id is null — resolve via round_player_id
    playerId: s.player_id ?? rpIdToPlayerId.get(s.round_player_id) ?? s.round_player_id,
    holeNumber: s.hole_number,
    strokes: s.strokes,
    putts: s.putts ?? null,
    fairwayHit: s.fairway_hit ?? null,
    greenInRegulation: s.gir ?? null,
  }));

  const initialRound = {
    id: roundData.id,
    courseId: roundData.course_id,
    courseName: (roundData.courses as any)?.name ?? 'Unknown Course',
    status: roundData.status as 'pending' | 'in_progress' | 'completed',
    date: roundData.round_date,
    players: roundData.round_players.map((rp: any) => {
      const isGuest = !rp.user_id;
      return {
        id: isGuest ? rp.id : rp.profiles.id,
        displayName: isGuest ? rp.guest_name : rp.profiles.display_name,
        handicap: isGuest
          ? rp.guest_handicap_index
          : rp.profiles.current_handicap_index,
        teeBoxId: rp.tee_box_id,
        teeTimeGroupId: rp.tee_time_group_id ?? null,
        playingHandicap: rp.playing_handicap ?? 0,
        isGuest,
      };
    }),
    holes: defaultHoles,
    holesByTeeBox,
    currentUserGroupId,
  };

  return <ScorecardView initialRound={initialRound} initialScores={initialScores} />;
}
