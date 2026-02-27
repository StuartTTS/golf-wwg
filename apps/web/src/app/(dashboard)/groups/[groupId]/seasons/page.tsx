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

interface SeasonsPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function GroupSeasonsPage({ params }: SeasonsPageProps) {
  const { groupId } = await params;
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

  // Fetch all seasons for this group
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, start_date, end_date, is_active, created_at')
    .eq('group_id', groupId)
    .order('start_date', { ascending: false });

  const activeSeasons = seasons?.filter((s) => s.is_active) ?? [];
  const inactiveSeasons = seasons?.filter((s) => !s.is_active) ?? [];

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
              Seasons
            </h1>
            <p className="mt-1 text-sm text-surface-300">
              Season-long points and standings for {group.name}.
            </p>
          </div>
          {isAdmin && (
            <Link href={`/groups/${groupId}/seasons/new`}>
              <Button>New Season</Button>
            </Link>
          )}
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
          className="text-sm font-medium text-gold-500 border-b-2 border-gold-500 pb-2"
        >
          Seasons
        </Link>
      </nav>

      {/* Active Seasons */}
      {activeSeasons.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-surface-50 mb-3">
            Active Seasons
          </h2>
          <div className="space-y-3">
            {activeSeasons.map((season) => (
              <Link
                key={season.id}
                href={`/groups/${groupId}/seasons/${season.id}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md border-golf-500 bg-golf-900/30">
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div>
                      <CardTitle className="text-base">{season.name}</CardTitle>
                      <CardDescription>
                        {new Date(season.start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' - '}
                        {new Date(season.end_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Inactive Seasons */}
      {inactiveSeasons.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-surface-50 mb-3">
            Past Seasons
          </h2>
          <div className="space-y-3">
            {inactiveSeasons.map((season) => (
              <Link
                key={season.id}
                href={`/groups/${groupId}/seasons/${season.id}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div>
                      <CardTitle className="text-base">{season.name}</CardTitle>
                      <CardDescription>
                        {new Date(season.start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' - '}
                        {new Date(season.end_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">Ended</Badge>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {(!seasons || seasons.length === 0) && (
        <Card>
          <CardHeader className="text-center py-12">
            <CardTitle className="text-lg">No seasons yet</CardTitle>
            <CardDescription className="mt-2">
              {isAdmin
                ? 'Create your first season to start tracking points and standings.'
                : 'No seasons have been created for this group yet.'}
            </CardDescription>
            {isAdmin && (
              <div className="mt-6">
                <Link href={`/groups/${groupId}/seasons/new`}>
                  <Button>Create First Season</Button>
                </Link>
              </div>
            )}
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
