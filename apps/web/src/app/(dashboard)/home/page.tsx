import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';
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

  // Use US Central time so round dates align with the user's local day
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

  // Upcoming rounds the user is playing in (today or future, not completed)
  const { data: upcomingRounds } = await supabase
    .from('rounds')
    .select('id, round_date, tee_time, status, course:courses(name), group:groups(name), round_players!inner(user_id)')
    .eq('round_players.user_id', user?.id ?? '')
    .neq('status', 'completed')
    .gte('round_date', today)
    .order('round_date', { ascending: true })
    .limit(10);

  // Past rounds the user played in (before today, most recent first)
  const { data: pastRounds } = await supabase
    .from('rounds')
    .select('id, round_date, tee_time, status, course:courses(name), group:groups(name), round_players!inner(user_id)')
    .eq('round_players.user_id', user?.id ?? '')
    .lt('round_date', today)
    .order('round_date', { ascending: false })
    .limit(5);

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user?.id ?? '')
    .single();

  const displayName = profile?.display_name ?? user?.email ?? 'Golfer';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">
          Welcome back, {displayName}
        </h1>
        <p className="mt-1 text-sm text-surface-300">
          Track your rounds, compete with friends, and improve your game.
        </p>
      </div>

      {/* Tee It Up Now — primary solo CTA (Type A) */}
      {featureFlags.teeItUp && featureFlags.playExperience && (
        <Link href="/tee-it-up" className="block">
          <Card className="transition-shadow hover:shadow-md cursor-pointer border-2 border-golf-600 bg-golf-900/20">
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Tee It Up Now</CardTitle>
                <CardDescription>
                  Start a solo round and track your score &amp; stats.
                </CardDescription>
              </div>
              <Button>Start</Button>
            </CardHeader>
          </Card>
        </Link>
      )}

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

      {/* Upcoming Rounds */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-surface-50">Upcoming Rounds</h2>
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
                        {(round.group as any)?.name ? `${(round.group as any).name} · ` : ''}
                        {new Date(round.round_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {round.tee_time && ` at ${round.tee_time}`}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={round.status === 'in_progress' ? 'secondary' : 'outline'}
                      className="capitalize"
                    >
                      {round.status?.replace('_', ' ')}
                    </Badge>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Past Rounds (collapsible) */}
      {pastRounds && pastRounds.length > 0 && (
        <section>
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-surface-300 hover:text-surface-100 transition-colors mb-3">
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
            <div className="space-y-3">
              {pastRounds.map((round) => (
                <Link key={round.id} href={`/rounds/${round.id}`} className="block">
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                      <div>
                        <CardTitle className="text-base">
                          {(round.course as any)?.name ?? 'Unknown Course'}
                        </CardTitle>
                        <CardDescription>
                          {(round.group as any)?.name ? `${(round.group as any).name} · ` : ''}
                          {new Date(round.round_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={round.status === 'completed' ? 'default' : 'outline'}
                        className="capitalize"
                      >
                        {round.status?.replace('_', ' ')}
                      </Badge>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
