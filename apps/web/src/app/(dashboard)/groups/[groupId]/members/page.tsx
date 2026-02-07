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
  Input,
} from '@/components/ui';

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

  // Determine current user's role
  const currentMember = members?.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'admin' || currentMember?.role === 'owner';

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
          className="text-sm text-dark-600 hover:text-dark-800 mb-2 inline-block"
        >
          &larr; Back to {group.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-dark-900">
          Members
        </h1>
        <p className="mt-1 text-sm text-dark-600">
          Manage members of {group.name}.
        </p>
      </div>

      {/* Invite Form (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invite a Member</CardTitle>
            <CardDescription>
              Send an invitation by email to add someone to the group.
            </CardDescription>
          </CardHeader>
          <form
            action={`/api/groups/${groupId}/invite`}
            method="POST"
            className="px-6 pb-6"
          >
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-dark-800"
                >
                  Email Address
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="friend@example.com"
                  required
                />
              </div>
              <Button type="submit">Send Invite</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Pending Invitations */}
      {isAdmin && invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Invitations</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6">
            <ul className="divide-y divide-gray-100">
              {invitations.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-dark-900">
                      {invite.email}
                    </p>
                    <p className="text-xs text-dark-600">
                      Invited{' '}
                      {new Date(invite.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <Badge variant="outline">Pending</Badge>
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
            <p className="text-sm text-dark-600 text-center py-6">
              No members found.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sortedMembers.map((member) => {
                const profile = member.profile as any;
                const isCurrentUser = member.user_id === user?.id;

                return (
                  <li
                    key={member.user_id}
                    className="flex items-center justify-between py-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-900/40 flex items-center justify-center text-sm font-semibold text-golf-600">
                        {(profile?.display_name ?? 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-dark-900">
                            {profile?.display_name ?? 'Unknown'}
                          </p>
                          {isCurrentUser && (
                            <span className="text-xs text-dark-500">(you)</span>
                          )}
                        </div>
                        <p className="text-xs text-dark-600">
                          {profile?.email ?? ''}
                          {profile?.current_handicap_index != null &&
                            ` · HCP: ${profile.current_handicap_index}`}
                        </p>
                        <p className="text-xs text-dark-500">
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

                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          member.role === 'owner'
                            ? 'default'
                            : member.role === 'admin'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="capitalize"
                      >
                        {member.role}
                      </Badge>
                      {isAdmin && !isCurrentUser && member.role !== 'owner' && (
                        <form
                          action={`/api/groups/${groupId}/members/${member.user_id}/remove`}
                          method="POST"
                        >
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="text-red-400 hover:text-red-400 hover:bg-red-900/30"
                          >
                            Remove
                          </Button>
                        </form>
                      )}
                    </div>
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
