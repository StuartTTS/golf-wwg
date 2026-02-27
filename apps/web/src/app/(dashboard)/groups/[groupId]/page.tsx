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

interface GroupDetailPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { groupId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch group details
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select(`
      id,
      name,
      description,
      default_course_id,
      created_at,
      default_course:courses (id, name)
    `)
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    notFound();
  }

  // Fetch members
  const { data: members } = await supabase
    .from('group_members')
    .select(`
      user_id,
      role,
      joined_at,
      profile:profiles (id, display_name, avatar_url, current_handicap_index)
    `)
    .eq('group_id', groupId)
    .order('role', { ascending: true });

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

  // Fetch upcoming rounds (today or future, not completed)
  const { data: upcomingRounds } = await supabase
    .from('rounds')
    .select(`
      id,
      round_date,
      tee_time,
      status,
      course:courses (name)
    `)
    .eq('group_id', groupId)
    .neq('status', 'completed')
    .gte('round_date', today)
    .order('round_date', { ascending: true });

  // Fetch past rounds (before today or completed)
  const { data: pastRounds } = await supabase
    .from('rounds')
    .select(`
      id,
      round_date,
      tee_time,
      status,
      course:courses (name)
    `)
    .eq('group_id', groupId)
    .lt('round_date', today)
    .order('round_date', { ascending: false })
    .limit(5);

  // Determine current user's role
  const currentMember = members?.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'admin' || currentMember?.role === 'owner';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <Link
          href="/groups"
          className="text-sm text-surface-300 hover:text-surface-100 mb-2 inline-block"
        >
          &larr; Back to Groups
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-surface-50">
              {group.name}
            </h1>
            {group.description && (
              <p className="mt-1 text-sm text-surface-300">{group.description}</p>
            )}
            {(group.default_course as any)?.name && (
              <p className="mt-1 text-xs text-surface-400">
                Default Course: {(group.default_course as any).name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/groups/${groupId}/rounds/new`}>
              <Button>New Round</Button>
            </Link>
            {isAdmin && (
              <Link href={`/groups/${groupId}/settings`}>
                <Button variant="outline">Settings</Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex gap-4 border-b border-surface-500 pb-2">
        <Link
          href={`/groups/${groupId}`}
          className="text-sm font-medium text-gold-500 border-b-2 border-gold-500 pb-2"
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
          className="text-sm font-medium text-surface-300 hover:text-surface-100 pb-2"
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

      {/* Upcoming Rounds — top priority */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Upcoming Rounds</CardTitle>
            <Link href={`/groups/${groupId}/rounds/new`}>
              <Button size="sm">Schedule Round</Button>
            </Link>
          </div>
        </CardHeader>
        <div className="px-6 pb-6">
          {!upcomingRounds || upcomingRounds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-surface-300 mb-4">
                No upcoming rounds scheduled.
              </p>
              <Link href={`/groups/${groupId}/rounds/new`}>
                <Button variant="outline">Schedule a Round</Button>
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingRounds.map((round) => (
                <li key={round.id}>
                  <Link
                    href={`/rounds/${round.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-700 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-50">
                        {(round.course as any)?.name ?? 'Unknown Course'}
                      </p>
                      <p className="text-xs text-surface-300">
                        {new Date(round.round_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {round.tee_time && ` at ${round.tee_time}`}
                      </p>
                    </div>
                    <Badge
                      variant={round.status === 'in_progress' ? 'secondary' : 'outline'}
                      className="capitalize"
                    >
                      {round.status?.replace('_', ' ')}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Members Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Members</CardTitle>
            <Link href={`/groups/${groupId}/members`}>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <div className="px-6 pb-6">
          {!members || members.length === 0 ? (
            <p className="text-sm text-surface-300">No members found.</p>
          ) : (
            <ul className="space-y-3">
              {members.slice(0, 8).map((member) => (
                <li
                  key={member.user_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-900/40 flex items-center justify-center text-sm font-medium text-golf-600">
                      {((member.profile as any)?.display_name ?? 'U')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-50">
                        {(member.profile as any)?.display_name ?? 'Unknown'}
                      </p>
                      {(member.profile as any)?.current_handicap_index != null && (
                        <p className="text-xs text-surface-300">
                          HCP: {(member.profile as any).current_handicap_index}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {member.role}
                  </Badge>
                </li>
              ))}
              {members.length > 8 && (
                <li className="text-xs text-surface-300 text-center pt-1">
                  +{members.length - 8} more
                </li>
              )}
            </ul>
          )}
        </div>
      </Card>

      {/* Past Rounds (collapsible) */}
      {pastRounds && pastRounds.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-surface-300 hover:text-surface-100 transition-colors">
            <svg
              className="w-4 h-4 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Past Rounds ({pastRounds.length})
          </summary>
          <Card className="mt-3">
            <div className="px-6 py-4">
              <ul className="space-y-3">
                {pastRounds.map((round) => (
                  <li key={round.id}>
                    <Link
                      href={`/rounds/${round.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-700 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-surface-50">
                          {(round.course as any)?.name ?? 'Unknown Course'}
                        </p>
                        <p className="text-xs text-surface-300">
                          {new Date(round.round_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <Badge
                        variant={round.status === 'completed' ? 'default' : 'outline'}
                        className="capitalize"
                      >
                        {round.status?.replace('_', ' ')}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </details>
      )}

      {/* Leaderboard Quick Link */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Leaderboard</CardTitle>
            <CardDescription>
              See who leads the pack in your group.
            </CardDescription>
          </div>
          <Link href={`/groups/${groupId}/leaderboard`}>
            <Button>View Leaderboard</Button>
          </Link>
        </CardHeader>
      </Card>
    </div>
  );
}
