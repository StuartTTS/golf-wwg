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

  // Fetch recent rounds for this group
  const { data: recentRounds } = await supabase
    .from('rounds')
    .select(`
      id,
      round_date,
      status,
      scoring_mode,
      course:courses (name)
    `)
    .eq('group_id', groupId)
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
          className="text-sm text-dark-600 hover:text-dark-800 mb-2 inline-block"
        >
          &larr; Back to Groups
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-dark-900">
              {group.name}
            </h1>
            {group.description && (
              <p className="mt-1 text-sm text-dark-600">{group.description}</p>
            )}
            {(group.default_course as any)?.name && (
              <p className="mt-1 text-xs text-dark-500">
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
      <nav className="flex gap-4 border-b border-dark-300 pb-2">
        <Link
          href={`/groups/${groupId}`}
          className="text-sm font-medium text-golf-600 border-b-2 border-green-600 pb-2"
        >
          Overview
        </Link>
        <Link
          href={`/groups/${groupId}/members`}
          className="text-sm font-medium text-dark-600 hover:text-dark-800 pb-2"
        >
          Members
        </Link>
        <Link
          href={`/groups/${groupId}/rounds`}
          className="text-sm font-medium text-dark-600 hover:text-dark-800 pb-2"
        >
          Rounds
        </Link>
        <Link
          href={`/groups/${groupId}/leaderboard`}
          className="text-sm font-medium text-dark-600 hover:text-dark-800 pb-2"
        >
          Leaderboard
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
              <p className="text-sm text-dark-600">No members found.</p>
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
                        <p className="text-sm font-medium text-dark-900">
                          {(member.profile as any)?.display_name ?? 'Unknown'}
                        </p>
                        {(member.profile as any)?.current_handicap_index != null && (
                          <p className="text-xs text-dark-600">
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
                  <li className="text-xs text-dark-600 text-center pt-1">
                    +{members.length - 8} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </Card>

        {/* Recent Rounds */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Rounds</CardTitle>
              <Link href={`/groups/${groupId}/rounds`}>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <div className="px-6 pb-6">
            {!recentRounds || recentRounds.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-dark-600 mb-4">
                  No rounds have been played yet.
                </p>
                <Link href={`/groups/${groupId}/rounds/new`}>
                  <Button variant="outline">Create First Round</Button>
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {recentRounds.map((round) => (
                  <li key={round.id}>
                    <Link
                      href={`/rounds/${round.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-dark-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-dark-900">
                          {(round.course as any)?.name ?? 'Unknown Course'}
                        </p>
                        <p className="text-xs text-dark-600">
                          {new Date(round.round_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            round.status === 'completed'
                              ? 'default'
                              : round.status === 'in_progress'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="capitalize"
                        >
                          {round.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

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
