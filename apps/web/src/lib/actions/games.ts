'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createGameSchema } from '@golf/core';
import type { Json } from '@/lib/supabase/database.types';

export async function createGame(input: {
  roundId: string;
  format: string;
  name?: string;
  config: Record<string, unknown>;
  moneyPerUnit?: number;
  holes?: string;
  playerIds: string[];
  teams?: { teamName: string; playerIds: string[] }[];
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createGameSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  // Create the game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      round_id: input.roundId,
      format: input.format,
      name: input.name ?? null,
      config: input.config as Json,
      money_per_unit: input.moneyPerUnit ?? null,
      status: 'active',
      holes: input.holes ?? 'all',
    })
    .select()
    .single();

  if (gameError) {
    console.error('Action error:', gameError);
    return { error: 'An error occurred. Please try again.' };
  }

  // Create teams if needed
  const teamMap: Record<string, string> = {};
  if (input.teams && input.teams.length > 0) {
    for (let i = 0; i < input.teams.length; i++) {
      const team = input.teams[i];
      const { data: teamData, error: teamError } = await supabase
        .from('game_teams')
        .insert({
          game_id: game.id,
          team_name: team.teamName,
          team_order: i + 1,
        })
        .select()
        .single();

      if (teamError) {
        console.error('Action error:', teamError);
        return { error: 'An error occurred. Please try again.' };
      }
      for (const pid of team.playerIds) {
        teamMap[pid] = teamData.id;
      }
    }
  }

  // Add players
  const playerRows = input.playerIds.map((pid) => ({
    game_id: game.id,
    player_id: pid,
    team_id: teamMap[pid] ?? null,
  }));

  const { error: playerError } = await supabase
    .from('game_players')
    .insert(playerRows);

  if (playerError) {
    console.error('Action error:', playerError);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true, gameId: game.id };
}

export async function finalizeGame(gameId: string, results: Record<string, unknown>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: game } = await supabase
    .from('games')
    .select('round_id, rounds(created_by, group_id)')
    .eq('id', gameId)
    .single();
  if (!game) return { error: 'Game not found' };

  const round = (game as any).rounds;
  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Not authorized' };

  const { error } = await supabase
    .from('games')
    .update({
      results: results as Json,
      status: 'finalized',
    })
    .eq('id', gameId);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}

export async function deleteGame(gameId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: game } = await supabase
    .from('games')
    .select('round_id, rounds(created_by, group_id)')
    .eq('id', gameId)
    .single();
  if (!game) return { error: 'Game not found' };

  const round = (game as any).rounds;
  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Not authorized' };

  // Delete game players and teams first
  await supabase.from('game_players').delete().eq('game_id', gameId);
  await supabase.from('game_teams').delete().eq('game_id', gameId);
  const { error } = await supabase.from('games').delete().eq('id', gameId);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}
