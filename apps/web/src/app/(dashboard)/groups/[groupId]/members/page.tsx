import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
} from '@/components/ui';
import { InviteForm } from '@/components/groups/invite-form';
import { DeleteInvitationButton } from './delete-invitation-button';
import { MemberActions } from './member-actions';

interface MembersPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function GroupMembersPage({ params }: MembersPageProps) {
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

  // Fetch members with profiles
  const { data: members } = await supabase
    .from('group_members')
    .select(`
      user_id,
      role,
      joined_at,
      profile:profiles (id, display_name, email, avatar_url, current_handicap_index)
    `)
    .eq('group_id', groupId)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true });

  // Fetch pending invitations
  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, email, status, created_at')
    .eq('group_id', groupId)
    .eq('status', 'pending');

  // Determine current user's role and site admin status
  const currentMember = members?.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'admin' || currentMember?.role === 'owner';

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('is_site_admin')
    .eq('id', user!.id)
    .single();
  const isSiteAdmin = callerProfile?.is_site_admin === true;

  const roleOrder: Record<string, number> = {
    owner: 0,
    admin: 1,
    member: 2,
  };

  const sortedMembers = [...(members ?? [])].sort(
    (a, b) => (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99)
  );

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
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">
          Members
        </h1>
        <p className="mt-1 text-sm text-surface-300">
          Manage members of {group.name}.
        </p>
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
          className="text-sm font-medium text-gold-500 border-b-2 border-gold-500 pb-2"
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

      {/* Invite Form (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invite a Member</CardTitle>
            <CardDescription>
              Send an invitation by email to add someone to the group.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <InviteForm groupId={groupId} />
          </div>
        </Card>
      )}

      {/* Pending Invitations */}
      {isAdmin && invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Invitations</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6">
            <ul className="divide-y divide-surface-600">
              {invitations.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-surface-50">
                      {invite.email}
                    </p>
                    <p className="text-xs text-surface-300">
                      Invited{' '}
                      {new Date(invite.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Pending</Badge>
                    <DeleteInvitationButton groupId={groupId} invitationId={invite.id} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            All Members ({sortedMembers.length})
          </CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          {sortedMembers.length === 0 ? (
            <p className="text-sm text-surface-300 text-center py-6">
              No members found.
            </p>
          ) : (
            <ul className="divide-y divide-surface-600">
              {sortedMembers.map((member) => {
                const profile = member.profile as any;
                const isCurrentUser = member.user_id === user?.id;
                const showActions = isAdmin && !isCurrentUser && member.role !== 'owner';

                return (
                  <li
                    key={member.user_id}
                    className="py-4 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-900/40 flex items-center justify-center text-sm font-semibold text-golf-600">
                        {(profile?.display_name ?? 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-surface-50 truncate">
                            {profile?.display_name ?? 'Unknown'}
                          </p>
                          {isCurrentUser && (
                            <span className="text-xs text-surface-400 shrink-0">(you)</span>
                          )}
                          <Badge
                            variant={
                              member.role === 'owner'
                                ? 'default'
                                : member.role === 'admin'
                                  ? 'secondary'
                                  : 'outline'
                            }
                            className="capitalize shrink-0"
                          >
                            {member.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-surface-300 truncate">
                          {profile?.email ?? ''}
                          {profile?.current_handicap_index != null &&
                            ` · HCP: ${profile.current_handicap_index}`}
                        </p>
                        <p className="text-xs text-surface-400">
                          Joined{' '}
                          {new Date(member.joined_at).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    {showActions && (
                      <div className="pl-[52px]">
                        <MemberActions
                          groupId={groupId}
                          userId={member.user_id}
                          currentRole={member.role}
                          isSiteAdmin={isSiteAdmin}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
