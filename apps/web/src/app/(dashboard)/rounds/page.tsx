import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { DeleteRoundButton } from '@/components/rounds/delete-round-button';

export const metadata = { title: 'Rounds | Golf App' };

interface RoundRow {
  id: string;
  round_date: string;
  tee_time: string | null;
  status: 'upcoming' | 'in_progress' | 'completed';
  created_by: string;
  course: { name: string } | null;
  group: { name: string } | null;
}

function RoundCard({ round, canDelete }: { round: RoundRow; canDelete: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={`/rounds/${round.id}`} className="block flex-1 min-w-0">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
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
              variant={
                round.status === 'in_progress'
                  ? 'secondary'
                  : round.status === 'completed'
                    ? 'default'
                    : 'outline'
              }
              className="capitalize whitespace-nowrap"
            >
              {round.status?.replace('_', ' ')}
            </Badge>
          </CardHeader>
        </Card>
      </Link>
      {canDelete && (
        <DeleteRoundButton
          roundId={round.id}
          courseName={(round.course as any)?.name}
          variant="link"
        />
      )}
    </div>
  );
}

function Section({ title, rounds, userId }: { title: string; rounds: RoundRow[]; userId: string }) {
  if (rounds.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-surface-50 mb-3">
        {title} <span className="text-surface-400 font-normal">({rounds.length})</span>
      </h2>
      <div className="space-y-3">
        {rounds.map((r) => (
          <RoundCard key={r.id} round={r} canDelete={r.created_by === userId} />
        ))}
      </div>
    </section>
  );
}

export default async function RoundsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Every round the current user is a player in, newest first.
  const { data } = await supabase
    .from('rounds')
    .select(
      'id, round_date, tee_time, status, created_by, course:courses(name), group:groups(name), round_players!inner(user_id)'
    )
    .eq('round_players.user_id', user.id)
    .order('round_date', { ascending: false })
    .limit(200);

  const rounds = (data as any as RoundRow[]) ?? [];
  const inProgress = rounds.filter((r) => r.status === 'in_progress');
  const upcoming = rounds.filter((r) => r.status === 'upcoming');
  const completed = rounds.filter((r) => r.status === 'completed');

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">Rounds</h1>
        <p className="mt-1 text-sm text-surface-300">
          Every round you&apos;re playing in.
        </p>
      </div>

      {rounds.length === 0 ? (
        <Card>
          <CardHeader>
            <CardDescription className="text-center py-6">
              No rounds yet. Start one from <Link href="/home" className="text-golf-400 hover:underline">Home</Link>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Section title="In progress" rounds={inProgress} userId={user.id} />
          <Section title="Upcoming" rounds={upcoming} userId={user.id} />
          <Section title="Completed" rounds={completed} userId={user.id} />
        </>
      )}
    </div>
  );
}
