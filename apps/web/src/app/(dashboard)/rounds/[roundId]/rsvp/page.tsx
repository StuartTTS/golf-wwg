import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RsvpActions from './rsvp-actions';

interface RsvpPageProps {
  params: Promise<{ roundId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function RsvpPage({ params, searchParams }: RsvpPageProps) {
  const { roundId } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold text-surface-50">Invalid Link</h1>
        <p className="mt-2 text-sm text-surface-300">This RSVP link is missing a token.</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/rounds/${roundId}/rsvp?token=${encodeURIComponent(token)}`);
  }

  // Fetch invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, status, expires_at, round_id')
    .eq('token', token)
    .eq('type', 'round')
    .single();

  if (!invitation || invitation.round_id !== roundId) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold text-surface-50">Invalid Invitation</h1>
        <p className="mt-2 text-sm text-surface-300">
          This RSVP link is invalid or has expired.
        </p>
      </div>
    );
  }

  if (invitation.status !== 'pending') {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold text-surface-50">Already Responded</h1>
        <p className="mt-2 text-sm text-surface-300">
          You have already {invitation.status} this round invitation.
        </p>
      </div>
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold text-surface-50">Invitation Expired</h1>
        <p className="mt-2 text-sm text-surface-300">
          This round invitation has expired. Please ask the organizer to send a new one.
        </p>
      </div>
    );
  }

  // Fetch round details
  const { data: round } = await supabase
    .from('rounds')
    .select(`
      id, round_date, tee_time, status,
      courses(name),
      profiles!rounds_created_by_fkey(display_name),
      groups(name)
    `)
    .eq('id', roundId)
    .single();

  if (!round) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold text-surface-50">Round Not Found</h1>
        <p className="mt-2 text-sm text-surface-300">This round no longer exists.</p>
      </div>
    );
  }

  const course = round.courses as any;
  const organizer = round.profiles as any;
  const group = round.groups as any;

  // Fetch who already accepted
  const { data: acceptedPlayers } = await supabase
    .from('round_players')
    .select('profiles(display_name)')
    .eq('round_id', roundId)
    .in('status', ['registered', 'confirmed']);

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      <div className="text-center">
        <p className="text-sm text-surface-300">You're invited to a round</p>
        <h1 className="mt-2 text-2xl font-bold text-surface-50">
          {course?.name ?? 'Golf Round'}
        </h1>
      </div>

      <div className="rounded-golf border border-surface-600/50 bg-surface-700/50 p-5 space-y-3">
        <dl className="space-y-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">Group</dt>
            <dd className="mt-1 text-sm text-surface-100">{group?.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">Date</dt>
            <dd className="mt-1 text-sm text-surface-100">
              {new Date(round.round_date).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              })}
            </dd>
          </div>
          {round.tee_time && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">Tee Time</dt>
              <dd className="mt-1 text-sm text-surface-100">{round.tee_time}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">Organized by</dt>
            <dd className="mt-1 text-sm text-surface-100">{organizer?.display_name}</dd>
          </div>
        </dl>

        {acceptedPlayers && acceptedPlayers.length > 0 && (
          <div className="pt-3 border-t border-surface-600/50">
            <dt className="text-xs font-medium uppercase tracking-wide text-surface-400 mb-2">
              Playing ({acceptedPlayers.length})
            </dt>
            <div className="flex flex-wrap gap-2">
              {acceptedPlayers.map((p: any, i: number) => (
                <span key={i} className="text-xs bg-golf-900/40 text-golf-400 px-2 py-1 rounded-full">
                  {p.profiles?.display_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <RsvpActions token={token} roundId={roundId} />
    </div>
  );
}
