import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InviteActions from './invite-actions';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const supabase = await createServerSupabaseClient();

  // Fetch the invite details
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .single();

  const invite = data as {
    id: string;
    status: string;
    group_id: string;
    email: string;
    type: string;
    token: string;
    invited_by: string;
    round_id: string | null;
    created_at: string;
    expires_at: string;
  } | null;

  // If the invite doesn't exist or has already been used, show an error
  if (error || !invite) {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Invalid Invite
          </h1>
          <p className="mt-4 text-sm text-gray-600">
            This invite link is invalid or has expired. Please ask the group
            admin to send a new invite.
          </p>
        </div>
      </div>
    );
  }

  if (invite.status !== 'pending') {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Invite Already Used
          </h1>
          <p className="mt-4 text-sm text-gray-600">
            This invite has already been{' '}
            {invite.status === 'accepted' ? 'accepted' : 'declined'}.
          </p>
        </div>
      </div>
    );
  }

  // Check whether the user is logged in
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Redirect to login with a return URL so the user comes back after
    // authenticating.
    redirect(`/login?returnTo=/invite/${token}`);
  }

  const { data: groupData } = await supabase
    .from('groups')
    .select('name')
    .eq('id', invite.group_id)
    .single();
  const groupName = (groupData as { name: string } | null)?.name ?? 'a group';

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          You&apos;re Invited!
        </h1>
        <p className="mt-4 text-sm text-gray-600">
          You&apos;ve been invited to join{' '}
          <span className="font-semibold text-gray-900">{groupName}</span>.
        </p>
      </div>

      {/* Invite details card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <dl className="space-y-4">
          {invite.email && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Invited email
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {invite.email}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Group
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{groupName}</dd>
          </div>
          {invite.type && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Invite type
              </dt>
              <dd className="mt-1 text-sm capitalize text-gray-900">
                {invite.type}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Accept / Decline buttons – rendered in a client component so they can
          handle transitions and error state. */}
      <InviteActions token={token} />
    </div>
  );
}
