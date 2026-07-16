import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';
import SetupView, {
  type SetupGame,
  type SetupFlight,
} from './setup-view';

interface SetupPageProps {
  params: Promise<{ roundId: string }>;
}

export default async function RoundSetupPage({ params }: SetupPageProps) {
  if (!featureFlags.playExperience) notFound();

  const { roundId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: round, error } = await supabase
    .from('rounds')
    .select('id, created_by, group_id, status, courses ( name )')
    .eq('id', roundId)
    .single();
  if (error || !round) notFound();

  // Commish = round creator; group admins may also configure.
  let canEdit = round.created_by === user.id;
  if (!canEdit && round.group_id) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    canEdit = membership?.role === 'admin';
  }

  const { data: gamesData } = await supabase
    .from('games')
    .select('id, format, name, config')
    .eq('round_id', roundId)
    .order('created_at');

  const games: SetupGame[] = (gamesData ?? []).map((g: any) => ({
    id: g.id,
    format: g.format,
    name: g.name,
    useNet: (g.config?.useNet ?? true) !== false,
    handicapAllowance:
      typeof g.config?.handicapAllowance === 'number'
        ? g.config.handicapAllowance
        : null,
  }));

  const { data: flightData } = await supabase
    .from('tee_time_groups')
    .select('id, name, sort_order, scorer_id')
    .eq('round_id', roundId)
    .order('sort_order');

  const { data: playersData } = await supabase
    .from('round_players')
    .select(
      'id, user_id, tee_time_group_id, guest_name, profiles:profiles!round_players_user_id_fkey ( id, display_name )'
    )
    .eq('round_id', roundId);

  const flights: SetupFlight[] = (flightData ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    scorerId: f.scorer_id ?? null,
    // Only registered members can be a scorer (guests have no login).
    members: (playersData ?? [])
      .filter((p: any) => p.tee_time_group_id === f.id && p.user_id)
      .map((p: any) => ({
        userId: p.user_id as string,
        displayName: p.profiles?.display_name ?? 'Player',
      })),
  }));

  return (
    <SetupView
      roundId={roundId}
      courseName={(round.courses as any)?.name ?? 'Round'}
      canEdit={canEdit}
      games={games}
      flights={flights}
    />
  );
}
