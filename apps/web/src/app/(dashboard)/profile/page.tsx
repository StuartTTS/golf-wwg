'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/providers/supabase-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Profile {
  id: string;
  displayName: string;
  email: string;
  handicap: number | null;
  handicapUpdatedAt: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface RecentRound {
  id: string;
  date: string;
  courseName: string;
  grossScore: number;
  toPar: number;
  totalPar: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const { supabase, user } = useSupabase();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!supabase || !user) return;

      try {
        setLoading(true);

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, email, current_handicap_index, updated_at, avatar_url, created_at')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        setProfile({
          id: profileData.id,
          displayName: profileData.display_name,
          email: profileData.email,
          handicap: profileData.current_handicap_index,
          handicapUpdatedAt: profileData.updated_at,
          avatarUrl: profileData.avatar_url,
          createdAt: profileData.created_at,
        });

        // Fetch recent rounds
        const { data: roundsData, error: roundsError } = await supabase
          .from('round_players')
          .select(`
            rounds (
              id,
              date,
              status,
              courses ( name )
            )
          `)
          .eq('player_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!roundsError && roundsData) {
          const roundIds = roundsData
            .map((rp: any) => rp.rounds?.id)
            .filter(Boolean);

          if (roundIds.length > 0) {
            const { data: scoresData } = await supabase
              .from('scores')
              .select('round_id, hole_number, strokes')
              .eq('player_id', user.id)
              .in('round_id', roundIds);

            const { data: holesDataAll } = await supabase
              .from('rounds')
              .select(`
                id,
                round_players!inner (
                  tee_box_id,
                  player_id
                )
              `)
              .in('id', roundIds)
              .eq('round_players.player_id', user.id);

            const rounds: RecentRound[] = roundsData
              .filter((rp: any) => rp.rounds && rp.rounds.status === 'completed')
              .map((rp: any) => {
                const round = rp.rounds;
                const roundScores = (scoresData ?? []).filter(
                  (s: any) => s.round_id === round.id
                );
                const grossScore = roundScores.reduce(
                  (sum: number, s: any) => sum + (s.strokes ?? 0),
                  0
                );

                return {
                  id: round.id,
                  date: round.date,
                  courseName: round.courses?.name ?? 'Unknown',
                  grossScore,
                  toPar: 0,
                  totalPar: 72,
                };
              });

            setRecentRounds(rounds);
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [supabase, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-dark-600">Profile not found</p>
      </div>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Profile header */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-900/40 flex items-center justify-center text-golf-600 text-2xl font-bold">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-dark-900">
                {profile.displayName}
              </h1>
              <p className="text-sm text-dark-600">{profile.email}</p>
              <p className="text-xs text-dark-500 mt-1">
                Member since {memberSince}
              </p>
            </div>
            <Link href="/settings">
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Handicap card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-600 uppercase tracking-wide font-semibold">
                Handicap Index
              </p>
              <p className="text-4xl font-bold text-dark-900 mt-1">
                {profile.handicap !== null ? profile.handicap.toFixed(1) : 'N/A'}
              </p>
              {profile.handicapUpdatedAt && (
                <p className="text-xs text-dark-500 mt-1">
                  Updated{' '}
                  {new Date(profile.handicapUpdatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <Link href="/profile/handicap">
              <Button variant="outline" size="sm">
                View History
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-dark-600 uppercase tracking-wide">
              Rounds
            </p>
            <p className="text-2xl font-bold text-dark-900 mt-1">
              {recentRounds.length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-dark-600 uppercase tracking-wide">
              Best Score
            </p>
            <p className="text-2xl font-bold text-dark-900 mt-1">
              {recentRounds.length > 0
                ? Math.min(...recentRounds.map((r) => r.grossScore))
                : '-'}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-dark-600 uppercase tracking-wide">
              Average
            </p>
            <p className="text-2xl font-bold text-dark-900 mt-1">
              {recentRounds.length > 0
                ? (
                    recentRounds.reduce((sum, r) => sum + r.grossScore, 0) /
                    recentRounds.length
                  ).toFixed(1)
                : '-'}
            </p>
          </div>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/profile/stats">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-dark-900">Statistics</p>
                <p className="text-xs text-dark-600">View detailed stats</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/profile/handicap">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-golf-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-dark-900">Handicap</p>
                <p className="text-xs text-dark-600">Track your index</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Recent rounds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Rounds</CardTitle>
          <CardDescription>Your latest completed rounds</CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          {recentRounds.length === 0 ? (
            <p className="text-sm text-dark-500 text-center py-4">
              No completed rounds yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentRounds.map((round) => (
                <Link key={round.id} href={`/rounds/${round.id}/results`}>
                  <div className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-dark-50 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-dark-900">
                        {round.courseName}
                      </p>
                      <p className="text-xs text-dark-600">
                        {new Date(round.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums text-dark-900">
                        {round.grossScore}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
