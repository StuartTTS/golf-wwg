'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function createSeason(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const groupId = formData.get('groupId') as string;
  const name = (formData.get('name') as string)?.trim();
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;

  if (!groupId || !name || !startDate || !endDate) {
    return { error: 'All fields are required' };
  }

  if (new Date(endDate) <= new Date(startDate)) {
    return { error: 'End date must be after start date' };
  }

  // Verify user is admin
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'admin') {
    return { error: 'Only group admins can create seasons' };
  }

  const { data: season, error } = await supabase
    .from('seasons')
    .insert({
      group_id: groupId,
      name,
      start_date: startDate,
      end_date: endDate,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Season creation error:', error);
    return { error: 'Failed to create season' };
  }

  return { success: true, seasonId: season.id };
}

export async function updateSeason(seasonId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const name = (formData.get('name') as string)?.trim();
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const isActive = formData.get('isActive') === 'true';

  if (!name || !startDate || !endDate) {
    return { error: 'All fields are required' };
  }

  const { error } = await supabase
    .from('seasons')
    .update({
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive,
    })
    .eq('id', seasonId);

  if (error) {
    console.error('Season update error:', error);
    return { error: 'Failed to update season' };
  }

  return { success: true };
}

export async function deleteSeason(seasonId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('seasons')
    .delete()
    .eq('id', seasonId);

  if (error) {
    console.error('Season deletion error:', error);
    return { error: 'Failed to delete season' };
  }

  return { success: true };
}

/**
 * Compute season standings by deriving points from completed game results
 * within the season's date range. Points: 1st=3, 2nd=2, 3rd=1 by default.
 */
export async function getSeasonStandings(seasonId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Fetch season
  const { data: season } = await supabase
    .from('seasons')
    .select('id, group_id, name, start_date, end_date, points_config, is_active')
    .eq('id', seasonId)
    .single();

  if (!season) return { error: 'Season not found' };

  const pointsConfig = (season.points_config as Record<string, number>) ?? { '1st': 3, '2nd': 2, '3rd': 1 };

  // Fetch completed rounds within season date range
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, round_date')
    .eq('group_id', season.group_id)
    .eq('status', 'completed')
    .gte('round_date', season.start_date)
    .lte('round_date', season.end_date)
    .order('round_date', { ascending: true });

  if (!rounds || rounds.length === 0) {
    return { season, standings: [], rounds: [] };
  }

  // Fetch all games with results for these rounds
  const roundIds = rounds.map(r => r.id);
  const { data: games } = await supabase
    .from('games')
    .select('id, round_id, format, results, name')
    .in('round_id', roundIds)
    .eq('status', 'finalized');

  // Compute points per player
  const playerPoints: Record<string, { points: number; wins: number; roundsPlayed: Set<string> }> = {};

  games?.forEach(game => {
    const results = game.results as any;
    if (!results?.rankings) return;

    // rankings is an array of { player_id, position, ... }
    results.rankings.forEach((ranking: any) => {
      const playerId = ranking.player_id;
      if (!playerId) return;

      if (!playerPoints[playerId]) {
        playerPoints[playerId] = { points: 0, wins: 0, roundsPlayed: new Set() };
      }

      playerPoints[playerId].roundsPlayed.add(game.round_id);

      const position = ranking.position;
      if (position === 1) {
        playerPoints[playerId].points += pointsConfig['1st'] ?? 3;
        playerPoints[playerId].wins += 1;
      } else if (position === 2) {
        playerPoints[playerId].points += pointsConfig['2nd'] ?? 2;
      } else if (position === 3) {
        playerPoints[playerId].points += pointsConfig['3rd'] ?? 1;
      }
    });
  });

  // Fetch player profiles
  const playerIds = Object.keys(playerPoints);
  let profiles: any[] = [];
  if (playerIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, display_name, current_handicap_index')
      .in('id', playerIds);
    profiles = profileData ?? [];
  }

  // Build standings array
  const standings = profiles.map(profile => ({
    userId: profile.id,
    name: profile.display_name ?? 'Unknown',
    handicap: profile.current_handicap_index,
    points: playerPoints[profile.id]?.points ?? 0,
    wins: playerPoints[profile.id]?.wins ?? 0,
    roundsPlayed: playerPoints[profile.id]?.roundsPlayed.size ?? 0,
  })).sort((a, b) => b.points - a.points || b.wins - a.wins);

  return { season, standings, rounds };
}
