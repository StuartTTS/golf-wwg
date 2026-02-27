import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { acceptInvite } from '@/lib/actions/auth';
import Link from 'next/link';
import InviteActions from './invite-actions';

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ email?: string }>;
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const { email } = await searchParams;

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated — redirect to register (or they can click through to login)
  if (!user) {
    const redirectPath = `/invite/${token}`;
    const registerUrl = email
      ? `/register?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(email)}`
      : `/register?redirect=${encodeURIComponent(redirectPath)}`;
    redirect(registerUrl);
  }

  // Authenticated — check if this user matches the invite recipient
  if (email && user.email?.toLowerCase() !== email.toLowerCase()) {
    // Wrong account is logged in — sign them out and redirect to register
    await supabase.auth.signOut();
    const redirectPath = `/invite/${token}`;
    const registerUrl = `/register?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(email)}`;
    redirect(registerUrl);
  }

  // Look up the invitation to validate state and get group details
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, group_id, email, status, expires_at, invited_by')
    .eq('token', token)
    .single();

  if (!invitation) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-surface-50">
            Invalid Invitation
          </h1>
          <p className="mt-4 text-sm text-surface-300">
            This invitation link is invalid or has expired.
          </p>
          <Link
            href="/home"
            className="mt-4 inline-block text-sm font-medium text-golf-400 hover:text-golf-300"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (invitation.status !== 'pending') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-surface-50">
            Invitation Already {invitation.status === 'accepted' ? 'Accepted' : invitation.status === 'declined' ? 'Declined' : 'Used'}
          </h1>
          <p className="mt-4 text-sm text-surface-300">
            This invitation has already been {invitation.status}.
          </p>
          <Link
            href="/home"
            className="mt-4 inline-block text-sm font-medium text-golf-400 hover:text-golf-300"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-surface-50">
            Invitation Expired
          </h1>
          <p className="mt-4 text-sm text-surface-300">
            This invitation has expired. Please ask the group admin to send a new one.
          </p>
          <Link
            href="/home"
            className="mt-4 inline-block text-sm font-medium text-golf-400 hover:text-golf-300"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // Fetch group name and inviter name for display
  const { data: group } = await supabase
    .from('groups')
    .select('name')
    .eq('id', invitation.group_id)
    .single();

  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', invitation.invited_by)
    .single();

  const groupName = group?.name ?? 'a golf group';
  const inviterName = inviterProfile?.display_name ?? 'Someone';

  // New user (just registered via invite flow) — auto-accept
  const profileCompleted = user.user_metadata?.profile_completed;
  if (profileCompleted === false) {
    const result = await acceptInvite(token);

    if (result.error) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-surface-50">
              Invitation Error
            </h1>
            <p className="mt-4 text-sm text-surface-300">{result.error}</p>
            <p className="mt-2 text-sm text-surface-400">
              Please ask the group admin to send a new invite if needed.
            </p>
            <Link
              href="/home"
              className="mt-4 inline-block text-sm font-medium text-golf-400 hover:text-golf-300"
            >
              Go to Home
            </Link>
          </div>
        </div>
      );
    }

    // Send to profile setup with groupId so they land in the group after
    redirect(`/settings?setup=true&groupId=${result.groupId}`);
  }

  // Existing user — show accept/decline UI
  return <InviteActions token={token} groupName={groupName} inviterName={inviterName} />;
}
