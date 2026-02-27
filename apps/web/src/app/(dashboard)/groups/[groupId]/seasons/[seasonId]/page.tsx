import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSeasonStandings } from '@/lib/actions/seasons';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
} from '@/components/ui';

interface SeasonDetailPageProps {
  params: Promise<{ groupId: string; seasonId: string }>;
}

export default async function SeasonDetailPage({ params }: SeasonDetailPageProps) {
  const { groupId, seasonId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name')
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    notFound();
  }

  // Determine current user's role
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, role')
    .eq('group_id', groupId);

  const currentMember = members?.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'admin' || currentMember?.role === 'owner';

  // Fetch standings
  const result = await getSeasonStandings(seasonId);

  if ('error' in result && result.error) {
    notFound();
  }

  const { season, standings, rounds } = result as {
    season: any;
    standings: any[];
    rounds: any[];
  };

  if (!season) {
    notFound();
  }

  function getMedalColor(rank: number): string {
    switch (rank) {
      case 0:
        return 'bg-gold-500/20 text-gold-500 border-gold-400';
      case 1:
        return 'bg-surface-700 text-surface-100 border-surface-500';
      case 2:
        return 'bg-amber-700/20 text-amber-700 border-amber-700';
      default:
        return 'bg-surface-800 text-surface-200 border-surface-500';
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href={`/groups/${groupId}/seasons`}
          className="text-sm text-surface-300 hover:text-surface-100 mb-2 inline-block"
        >
          &larr; Back to Seasons
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-surface-50">
              {season.name}
            </h1>
            <p className="mt-1 text-sm text-surface-300">
              {new Date(season.start_date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              {' - '}
              {new Date(season.end_date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={season.is_active ? 'secondary' : 'outline'}>
              {season.is_active ? 'Active' : 'Ended'}
            </Badge>
            {isAdmin && (
              <Link href={`/groups/${groupId}/seasons/${seasonId}/edit`}>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardDescription>Rounds</CardDescription>
            <CardTitle className="text-2xl">{rounds?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardDescription>Players</CardDescription>
            <CardTitle className="text-2xl">{standings?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardDescription>Points Config</CardDescription>
            <CardTitle className="text-sm mt-1">
              1st: {(season.points_config as any)?.['1st'] ?? 3} &middot;
              2nd: {(season.points_config as any)?.['2nd'] ?? 2} &middot;
              3rd: {(season.points_config as any)?.['3rd'] ?? 1}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Standings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Standings</CardTitle>
          <CardDescription>
            Player rankings based on game results within the season date range.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          {!standings || standings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-surface-300">
                No standings yet. Standings are computed from finalized game results
                within the season date range.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-500">
                    <th className="text-left py-3 px-2 font-medium text-surface-300 w-12">
                      #
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-surface-300">
                      Player
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-surface-300">
                      Points
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-surface-300">
                      Wins
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-surface-300">
                      Rounds
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-surface-300">
                      HCP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((player: any, index: number) => (
                    <tr
                      key={player.userId}
                      className="border-b border-surface-600 hover:bg-surface-700"
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
                          <span className="font-medium text-surface-50">
                            {player.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="font-semibold text-surface-50">
                          {player.points}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center text-surface-200">
                        {player.wins}
                      </td>
                      <td className="py-3 px-2 text-center text-surface-200">
                        {player.roundsPlayed}
                      </td>
                      <td className="py-3 px-2 text-center text-surface-200">
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

      {/* Rounds in Season */}
      {rounds && rounds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Season Rounds</CardTitle>
            <CardDescription>
              Completed rounds within the season date range.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <ul className="space-y-2">
              {rounds.map((round: any) => (
                <li key={round.id}>
                  <Link
                    href={`/rounds/${round.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-700 transition-colors"
                  >
                    <p className="text-sm font-medium text-surface-50">
                      {new Date(round.round_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <Badge variant="default">Completed</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}
