'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSupabase } from '@/providers/supabase-provider';
import type { HoleScore } from '@golf/core';

interface UseRealtimeScoresOptions {
  roundId: string;
  onScoreChange: (scores: HoleScore[]) => void;
  onPresenceChange?: (users: { userId: string; displayName: string }[]) => void;
  userId?: string;
  displayName?: string;
}

export function useRealtimeScores({
  roundId,
  onScoreChange,
  onPresenceChange,
  userId,
  displayName,
}: UseRealtimeScoresOptions) {
  const supabase = useSupabase();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roundId) return;

    const channel = supabase.channel(`round:${roundId}`, {
      config: { presence: { key: userId || 'anonymous' } },
    });

    // Listen for score changes via Postgres Changes
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'scores',
        filter: `round_id=eq.${roundId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as {
            player_id: string;
            hole_number: number;
            strokes: number | null;
          };
          onScoreChange([
            {
              playerId: row.player_id,
              holeNumber: row.hole_number,
              strokes: row.strokes,
            },
          ]);
        }
      }
    );

    // Presence tracking
    if (onPresenceChange) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.entries(state).map(([, presences]) => {
          const p = presences[0] as { userId?: string; displayName?: string };
          return {
            userId: p.userId || 'unknown',
            displayName: p.displayName || 'Unknown',
          };
        });
        onPresenceChange(users);
      });
    }

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && userId) {
        await channel.track({
          userId,
          displayName: displayName || 'Player',
          online_at: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roundId, supabase, userId, displayName, onScoreChange, onPresenceChange]);

  const broadcastEvent = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event,
          payload,
        });
      }
    },
    []
  );

  return { broadcastEvent };
}
