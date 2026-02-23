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
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-surface-50">
            Invalid Invite
          </h1>
          <p className="mt-4 text-sm text-surface-300">
            This invite link is invalid or has expired. Please ask the group
            admin to send a new invite.
          </p>
        </div>
      </div>
    );
  }

  if (invite.status !== 'pending') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-surface-50">
            Invite Already Used
          </h1>
          <p className="mt-4 text-sm text-surface-300">
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
    redirect(`/login?redirect=/invite/${token}`);
  }

  const { data: groupData } = await supabase
    .from('groups')
    .select('name')
    .eq('id', invite.group_id)
    .single();
  const groupName = (groupData as { name: string } | null)?.name ?? 'a group';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-surface-300">
          You&apos;ve been invited to join
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-gold-500">
          {groupName}
        </h1>
      </div>

      {/* Invite details card */}
      <div className="rounded-golf border border-surface-600/50 bg-surface-700/50 p-5">
        <dl className="space-y-3">
          {invite.email && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">
                Invited email
              </dt>
              <dd className="mt-1 text-sm text-surface-100">
                {invite.email}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">
              Group
            </dt>
            <dd className="mt-1 text-sm text-surface-100">{groupName}</dd>
          </div>
          {invite.type && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">
                Invite type
              </dt>
              <dd className="mt-1 text-sm capitalize text-surface-100">
                {invite.type}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Accept / Decline buttons – rendered in a client component so they can
          handle transitions and error state. */}
      <InviteActions token={token} groupId={invite.group_id} />
    </div>
  );
}
