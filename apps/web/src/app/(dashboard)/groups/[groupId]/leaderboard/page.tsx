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

interface LeaderboardPageProps {
  params: Promise<{ groupId: string }>;
}

interface PlayerStats {
  userId: string;
  name: string;
  roundsPlayed: number;
  averageScore: number;
  bestScore: number;
  totalPoints: number;
  handicap: number | null;
}

export default async function GroupLeaderboardPage({
  params,
}: LeaderboardPageProps) {
  const { groupId } = await params;
  const supabase = await createServerSupabaseClient();

  // Fetch group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name')
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    notFound();
  }

  // Fetch leaderboard data: members with their round stats
  const { data: members } = await supabase
    .from('group_members')
    .select(`
      user_id,
      profile:profiles (id, display_name, current_handicap_index)
    `)
    .eq('group_id', groupId);

  // Fetch completed round scores for group members
  const { data: roundScores } = await supabase
    .from('round_players')
    .select(`
      user_id,
      round:rounds!inner (id, group_id, status)
    `)
    .eq('round.group_id', groupId)
    .eq('round.status', 'completed') as { data: any[] | null };

  // Compute per-player stats
  const statsMap = new Map<string, PlayerStats>();

  members?.forEach((member) => {
    const profile = member.profile as any;
    statsMap.set(member.user_id, {
      userId: member.user_id,
      name: profile?.display_name ?? 'Unknown',
      roundsPlayed: 0,
      averageScore: 0,
      bestScore: 0,
      totalPoints: 0,
      handicap: profile?.current_handicap_index ?? null,
    });
  });

  roundScores?.forEach((score) => {
    const stats = statsMap.get(score.user_id);
    if (stats && score.total_score != null) {
      stats.roundsPlayed += 1;
      stats.averageScore += score.total_score;
      if (stats.bestScore === 0 || score.total_score < stats.bestScore) {
        stats.bestScore = score.total_score;
      }
      stats.totalPoints += score.points ?? 0;
    }
  });

  // Compute averages
  statsMap.forEach((stats) => {
    if (stats.roundsPlayed > 0) {
      stats.averageScore = Math.round(
        (stats.averageScore / stats.roundsPlayed) * 10
      ) / 10;
    }
  });

  const leaderboard = Array.from(statsMap.values()).sort((a, b) => {
    // Sort by average score (lower is better), then by rounds played (more is better)
    if (a.roundsPlayed === 0 && b.roundsPlayed === 0) return 0;
    if (a.roundsPlayed === 0) return 1;
    if (b.roundsPlayed === 0) return -1;
    return a.averageScore - b.averageScore;
  });

  // Points leaderboard
  const pointsLeaderboard = Array.from(statsMap.values())
    .filter((s) => s.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);

  function getMedalColor(rank: number): string {
    switch (rank) {
      case 0:
        return 'bg-yellow-900/40 text-yellow-800 border-yellow-300';
      case 1:
        return 'bg-gray-100 text-dark-800 border-gray-300';
      case 2:
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-dark-100 text-dark-700 border-dark-300';
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href={`/groups/${groupId}`}
          className="text-sm text-dark-600 hover:text-dark-800 mb-2 inline-block"
        >
          &larr; Back to {group.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-dark-900">
          Leaderboard
        </h1>
        <p className="mt-1 text-sm text-dark-600">
          Player rankings for {group.name}.
        </p>
      </div>

      {/* Average Score Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Average Score Rankings</CardTitle>
          <CardDescription>
            Ranked by average score across completed rounds (lower is better).
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          {leaderboard.length === 0 ? (
            <p className="text-sm text-dark-600 text-center py-6">
              No players found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-300">
                    <th className="text-left py-3 px-2 font-medium text-dark-600 w-12">
                      #
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-dark-600">
                      Player
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-dark-600">
                      Rounds
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-dark-600">
                      Avg Score
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-dark-600">
                      Best
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-dark-600">
                      HCP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((player, index) => (
                    <tr
                      key={player.userId}
                      className="border-b border-gray-50 hover:bg-dark-50"
                    >
                      <td className="py-3 px-2">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${getMedalColor(
                            index
                          )}`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-emerald-900/40 flex items-center justify-center text-sm font-medium text-golf-600">
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-dark-900">
                            {player.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center text-dark-700">
                        {player.roundsPlayed}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {player.roundsPlayed > 0 ? (
                          <span className="font-semibold text-dark-900">
                            {player.averageScore}
                          </span>
                        ) : (
                          <span className="text-dark-500">--</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {player.bestScore > 0 ? (
                          <span className="text-dark-800">
                            {player.bestScore}
                          </span>
                        ) : (
                          <span className="text-dark-500">--</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center text-dark-700">
                        {player.handicap != null ? player.handicap : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Points Leaderboard */}
      {pointsLeaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Points Rankings</CardTitle>
            <CardDescription>
              Ranked by total points earned across all rounds.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-300">
                    <th className="text-left py-3 px-2 font-medium text-dark-600 w-12">
                      #
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-dark-600">
                      Player
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-dark-600">
                      Total Points
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-dark-600">
                      Rounds
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pointsLeaderboard.map((player, index) => (
                    <tr
                      key={player.userId}
                      className="border-b border-gray-50 hover:bg-dark-50"
                    >
                      <td className="py-3 px-2">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${getMedalColor(
                            index
                          )}`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-emerald-900/40 flex items-center justify-center text-sm font-medium text-golf-600">
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-dark-900">
                            {player.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="font-semibold text-dark-900">
                          {player.totalPoints}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center text-dark-700">
                        {player.roundsPlayed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {leaderboard.every((p) => p.roundsPlayed === 0) && (
        <Card>
          <CardHeader className="text-center py-8">
            <CardTitle className="text-lg">No rounds completed yet</CardTitle>
            <CardDescription className="mt-2">
              Complete some rounds to see the leaderboard come to life.
            </CardDescription>
            <div className="mt-4">
              <Link href={`/groups/${groupId}/rounds/new`}>
                <Button>Create a Round</Button>
              </Link>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
