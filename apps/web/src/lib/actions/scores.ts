'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreEntrySchema } from '@golf/core';

export async function upsertScore(input: {
  roundId: string;
  playerId: string;
  holeNumber: number;
  strokes: number | null;
  putts?: number | null;
  fairwayHit?: boolean | null;
  gir?: boolean | null;
  upAndDown?: boolean | null;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = scoreEntrySchema.safeParse({
    ...input,
    entered_by: user.id,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { error } = await supabase
    .from('scores')
    .upsert(
      {
        round_id: input.roundId,
        player_id: input.playerId,
        hole_number: input.holeNumber,
        strokes: input.strokes,
        putts: input.putts ?? null,
        fairway_hit: input.fairwayHit ?? null,
        gir: input.gir ?? null,
        up_and_down: input.upAndDown ?? null,
        entered_by: user.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'round_id,player_id,hole_number',
      }
    );

  if (error) return { error: error.message };
  return { success: true };
}

export async function batchUpsertScores(
  scores: {
    roundId: string;
    playerId: string;
    holeNumber: number;
    strokes: number | null;
    putts?: number | null;
    fairwayHit?: boolean | null;
    gir?: boolean | null;
    upAndDown?: boolean | null;
  }[]
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!Array.isArray(scores) || scores.length === 0) {
    return { error: 'Scores array is required' };
  }

  // Validate each score entry with Zod
  for (const score of scores) {
    const parsed = scoreEntrySchema.safeParse(score);
    if (!parsed.success) {
      return { error: parsed.error.errors[0].message };
    }
  }

  // Verify all scores belong to the same round and user is authorized
  const roundIds = [...new Set(scores.map((s) => s.roundId))];
  if (roundIds.length !== 1) {
    return { error: 'All scores must belong to the same round' };
  }

  const { data: round } = await supabase
    .from('rounds')
    .select('id, scoring_mode, scorekeeper_id')
    .eq('id', roundIds[0])
    .single();

  if (!round) return { error: 'Round not found' };

  // Verify the user is authorized to enter scores for this round
  if (round.scoring_mode === 'scorekeeper' && round.scorekeeper_id !== user.id) {
    return { error: 'Only the scorekeeper can enter scores in scorekeeper mode' };
  }

  if (round.scoring_mode === 'shared') {
    const { data: roundPlayer } = await supabase
      .from('round_players')
      .select('id')
      .eq('round_id', round.id)
      .eq('user_id', user.id)
      .single();

    if (!roundPlayer) {
      return { error: 'You are not a player in this round' };
    }
  }

  const rows = scores.map((s) => ({
    round_id: s.roundId,
    player_id: s.playerId,
    hole_number: s.holeNumber,
    strokes: s.strokes,
    putts: s.putts ?? null,
    fairway_hit: s.fairwayHit ?? null,
    gir: s.gir ?? null,
    up_and_down: s.upAndDown ?? null,
    entered_by: user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('scores')
    .upsert(rows, { onConflict: 'round_id,player_id,hole_number' });

  if (error) return { error: error.message };
  return { success: true };
}
