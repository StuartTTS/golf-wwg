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
