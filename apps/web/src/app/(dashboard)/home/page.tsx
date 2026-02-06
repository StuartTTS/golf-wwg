import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
} from '@/components/ui';

export const metadata = {
  title: 'Dashboard | Golf App',
};

export default async function DashboardHomePage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: recentRounds } = await supabase
    .from('rounds')
    .select('id, round_date, course:courses(name), status')
    .eq('created_by', user?.id ?? '')
    .order('round_date', { ascending: false })
    .limit(5);

  const { data: upcomingRounds } = await supabase
    .from('rounds')
    .select('id, round_date, course:courses(name), status, group:groups(name)')
    .gte('round_date', new Date().toISOString())
    .eq('status', 'upcoming')
    .order('round_date', { ascending: true })
    .limit(5);

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Golfer';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-dark-900">
          Welcome back, {displayName}
        </h1>
        <p className="mt-1 text-sm text-dark-600">
          Track your rounds, compete with friends, and improve your game.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/groups" className="block">
          <Card className="transition-shadow hover:shadow-md cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">My Groups</CardTitle>
              <CardDescription>
                View and manage your golf groups
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/groups/new" className="block">
          <Card className="transition-shadow hover:shadow-md cursor-pointer border-dashed border-2">
            <CardHeader>
              <CardTitle className="text-lg">Create a Group</CardTitle>
              <CardDescription>
                Start a new group and invite friends
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/groups" className="block">
          <Card className="transition-shadow hover:shadow-md cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">Start a Round</CardTitle>
              <CardDescription>
                Select a group and tee off
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Recent Rounds */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-dark-900">Recent Rounds</h2>
        </div>

        {!recentRounds || recentRounds.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription className="text-center py-6">
                No rounds played yet. Join a group and start your first round!
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentRounds.map((round) => (
              <Link key={round.id} href={`/rounds/${round.id}`} className="block">
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
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={round.status === 'completed' ? 'default' : 'secondary'}
                      >
                        {round.status}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Rounds */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-dark-900">Upcoming Rounds</h2>
        </div>

        {!upcomingRounds || upcomingRounds.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription className="text-center py-6">
                No upcoming rounds scheduled. Create one from a group page!
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingRounds.map((round) => (
              <Link key={round.id} href={`/rounds/${round.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div>
                      <CardTitle className="text-base">
                        {(round.course as any)?.name ?? 'Unknown Course'}
                      </CardTitle>
                      <CardDescription>
                        {(round.group as any)?.name ?? ''} &middot;{' '}
                        {new Date(round.round_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(round.round_date).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">Scheduled</Badge>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
