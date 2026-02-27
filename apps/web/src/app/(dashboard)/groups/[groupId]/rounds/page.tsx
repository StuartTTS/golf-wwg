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

interface GroupRoundsPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function GroupRoundsPage({ params }: GroupRoundsPageProps) {
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

  // Fetch all rounds for this group
  const { data: rounds, error: roundsError } = await supabase
    .from('rounds')
    .select(`
      id,
      round_date,
      status,
      scoring_mode,
      course:courses (name),
      created_by_profile:profiles!rounds_created_by_fkey (display_name),
      round_players (count)
    `)
    .eq('group_id', groupId)
    .order('round_date', { ascending: false });

  // Separate into upcoming and past rounds
  const now = new Date().toISOString();
  const upcomingRounds =
    rounds?.filter(
      (r) => r.status === 'scheduled' || (r.status === 'in_progress' && r.round_date >= now)
    ) ?? [];
  const completedRounds =
    rounds?.filter((r) => r.status === 'completed') ?? [];
  const inProgressRounds =
    rounds?.filter((r) => r.status === 'in_progress') ?? [];

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'scheduled':
        return 'outline';
      default:
        return 'outline';
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href={`/groups/${groupId}`}
          className="text-sm text-surface-300 hover:text-surface-100 mb-2 inline-block"
        >
          &larr; Back to {group.name}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-surface-50">
              Rounds
            </h1>
            <p className="mt-1 text-sm text-surface-300">
              All rounds for {group.name}.
            </p>
          </div>
          <Link href={`/groups/${groupId}/rounds/new`}>
            <Button>New Round</Button>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex gap-4 border-b border-surface-500 pb-2">
        <Link
          href={`/groups/${groupId}`}
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
        >
          Overview
        </Link>
        <Link
          href={`/groups/${groupId}/members`}
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
        >
          Members
        </Link>
        <Link
          href={`/groups/${groupId}/rounds`}
          className="text-sm font-medium text-gold-500 border-b-2 border-gold-500 pb-2"
        >
          Rounds
        </Link>
        <Link
          href={`/groups/${groupId}/leaderboard`}
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
        >
          Leaderboard
        </Link>
        <Link
          href={`/groups/${groupId}/seasons`}
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
        >
          Seasons
        </Link>
      </nav>

      {roundsError ? (
        <Card>
          <CardHeader>
            <CardDescription className="text-center py-6 text-red-500">
              Failed to load rounds. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !rounds || rounds.length === 0 ? (
        <Card>
          <CardHeader className="text-center py-12">
            <CardTitle className="text-lg">No rounds yet</CardTitle>
            <CardDescription className="mt-2">
              Create your first round to start tracking scores.
            </CardDescription>
            <div className="mt-6">
              <Link href={`/groups/${groupId}/rounds/new`}>
                <Button>Create First Round</Button>
              </Link>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* In Progress */}
          {inProgressRounds.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-surface-50 mb-3">
                In Progress
              </h2>
              <div className="space-y-3">
                {inProgressRounds.map((round) => (
                  <Link
                    key={round.id}
                    href={`/rounds/${round.id}`}
                    className="block"
                  >
                    <Card className="transition-shadow hover:shadow-md border-golf-500 bg-golf-900/30">
                      <CardHeader className="flex flex-row items-center justify-between py-4">
                        <div>
                          <CardTitle className="text-base">
                            {(round.course as any)?.name ?? 'Unknown Course'}
                          </CardTitle>
                          <CardDescription>
                            {new Date(round.round_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            {' · '}
                            {(round.round_players as any)?.[0]?.count ?? 0} players
                            {round.scoring_mode && ` · ${round.scoring_mode}`}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="capitalize">
                          In Progress
                        </Badge>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcomingRounds.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-surface-50 mb-3">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcomingRounds.map((round) => (
                  <Link
                    key={round.id}
                    href={`/rounds/${round.id}`}
                    className="block"
                  >
                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between py-4">
                        <div>
                          <CardTitle className="text-base">
                            {(round.course as any)?.name ?? 'Unknown Course'}
                          </CardTitle>
                          <CardDescription>
                            {new Date(round.round_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            at{' '}
                            {new Date(round.round_date).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                            {' · '}
                            {(round.round_players as any)?.[0]?.count ?? 0} players
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          Scheduled
                        </Badge>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completedRounds.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-surface-50 mb-3">
                Completed
              </h2>
              <div className="space-y-3">
                {completedRounds.map((round) => (
                  <Link
                    key={round.id}
                    href={`/rounds/${round.id}`}
                    className="block"
                  >
                    <Card className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between py-4">
                        <div>
                          <CardTitle className="text-base">
                            {(round.course as any)?.name ?? 'Unknown Course'}
                          </CardTitle>
                          <CardDescription>
                            {new Date(round.round_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            {' · '}
                            {(round.round_players as any)?.[0]?.count ?? 0} players
                            {round.scoring_mode && ` · ${round.scoring_mode}`}
                          </CardDescription>
                        </div>
                        <Badge variant="default" className="capitalize">
                          Completed
                        </Badge>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
