import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import GamesView from './games-view';

interface GamesPageProps {
  params: Promise<{ roundId: string }>;
}

export default async function GamesPage({ params }: GamesPageProps) {
  const { roundId } = await params;
  const supabase = await createServerSupabaseClient();

  // Verify round exists
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id')
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    notFound();
  }

  // Fetch games
  const { data: gamesData } = await supabase
    .from('games')
    .select(`
      id,
      format,
      name,
      status,
      money_per_unit,
      config,
      holes,
      results,
      game_players (
        player_id,
        playing_handicap,
        profiles:profiles!game_players_player_id_fkey (
          id,
          display_name
        )
      )
    `)
    .eq('round_id', roundId)
    .order('created_at');

  const games = (gamesData ?? []).map((g: any) => ({
    id: g.id,
    format: g.format,
    name: g.name || g.format,
    status: g.status,
    moneyPerUnit: g.money_per_unit ?? 0,
    config: g.config ?? {},
    holes: g.holes ?? 'all',
    players: (g.game_players ?? []).map((gp: any) => ({
      id: gp.profiles?.id ?? gp.player_id,
      displayName: gp.profiles?.display_name ?? 'Unknown',
      position: 0,
      score: '-',
      payout: 0,
    })),
  }));

  // Fetch round players for the add game modal
  const { data: playersData } = await supabase
    .from('round_players')
    .select(
      'id, user_id, guest_name, profiles:profiles!round_players_user_id_fkey(id, display_name)'
    )
    .eq('round_id', roundId);

  const roundPlayers = (playersData ?? []).map((rp: any) => ({
    userId: rp.user_id || rp.id, // user_id for members, id (PK) for guests
    displayName: rp.profiles?.display_name ?? rp.guest_name ?? 'Guest',
  }));

  return (
    <GamesView
      roundId={roundId}
      initialGames={games}
      initialRoundPlayers={roundPlayers}
    />
  );
}
