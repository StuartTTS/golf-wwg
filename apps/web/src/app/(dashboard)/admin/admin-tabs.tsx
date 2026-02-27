'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  toggleSiteAdmin,
  adminDeleteUser,
  adminDeleteGroup,
  adminDeleteInvitation,
} from '@/lib/actions/admin';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs';
import { Card, Badge } from '@/components/ui';

interface UserRow {
  id: string;
  display_name: string | null;
  email: string | null;
  is_site_admin: boolean;
  created_at: string;
  current_handicap_index: number | null;
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
}

interface InvitationRow {
  id: string;
  email: string;
  type: string;
  status: string;
  created_at: string;
  group_name: string | null;
}

interface AdminTabsProps {
  currentUserId: string;
  users: UserRow[];
  groups: GroupRow[];
  invitations: InvitationRow[];
}

function ActionButton({
  onClick,
  busy,
  variant = 'default',
  children,
}: {
  onClick: () => void;
  busy: boolean;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-golf px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        variant === 'danger'
          ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
          : 'bg-surface-700 text-surface-200 hover:bg-surface-600 hover:text-surface-50'
      }`}
    >
      {children}
    </button>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminTabs({ currentUserId, users, groups, invitations }: AdminTabsProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleToggleAdmin = async (userId: string) => {
    setBusyId(userId);
    const result = await toggleSiteAdmin(userId);
    if (result.error) {
      alert(result.error);
    }
    setBusyId(null);
    router.refresh();
  };

  const handleDeleteUser = async (userId: string, name: string | null) => {
    if (!confirm(`Permanently delete ${name ?? 'this user'} and all their data? This cannot be undone.`)) return;
    setBusyId(userId);
    const result = await adminDeleteUser(userId);
    if (result.error) {
      alert(result.error);
    }
    setBusyId(null);
    router.refresh();
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!confirm(`Delete the group "${name}" and all associated data? This cannot be undone.`)) return;
    setBusyId(groupId);
    const result = await adminDeleteGroup(groupId);
    if (result.error) {
      alert(result.error);
    }
    setBusyId(null);
    router.refresh();
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    setBusyId(invitationId);
    const result = await adminDeleteInvitation(invitationId);
    if (result.error) {
      alert(result.error);
    }
    setBusyId(null);
    router.refresh();
  };

  return (
    <Tabs defaultTab="users">
      <TabList className="mb-6">
        <Tab id="users">Users ({users.length})</Tab>
        <Tab id="groups">Groups ({groups.length})</Tab>
        <Tab id="invitations">Invitations ({invitations.length})</Tab>
      </TabList>

      {/* Users Tab */}
      <TabPanel id="users" className="space-y-3">
        {users.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-8">No users found.</p>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-surface-600">
              {users.map((u) => {
                const isCurrentUser = u.id === currentUserId;
                const busy = busyId === u.id;
                return (
                  <div key={u.id} className="px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Avatar + Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-900/40 flex items-center justify-center text-sm font-semibold text-golf-600">
                          {(u.display_name ?? 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-surface-50 truncate">
                              {u.display_name ?? 'Unknown'}
                            </p>
                            {isCurrentUser && (
                              <span className="text-xs text-surface-400">(you)</span>
                            )}
                            {u.is_site_admin && (
                              <Badge variant="warning" className="text-[10px]">Admin</Badge>
                            )}
                          </div>
                          <p className="text-xs text-surface-300 truncate">
                            {u.email ?? ''}
                            {u.current_handicap_index != null &&
                              ` · HCP: ${u.current_handicap_index}`}
                          </p>
                          <p className="text-xs text-surface-400">
                            Joined {formatDate(u.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      {!isCurrentUser && (
                        <div className="flex items-center gap-2 pl-[52px] sm:pl-0">
                          <ActionButton
                            onClick={() => handleToggleAdmin(u.id)}
                            busy={busy}
                          >
                            {busy ? '...' : u.is_site_admin ? 'Revoke Admin' : 'Make Admin'}
                          </ActionButton>
                          <ActionButton
                            onClick={() => handleDeleteUser(u.id, u.display_name)}
                            busy={busy}
                            variant="danger"
                          >
                            {busy ? '...' : 'Delete'}
                          </ActionButton>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </TabPanel>

      {/* Groups Tab */}
      <TabPanel id="groups" className="space-y-3">
        {groups.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-8">No groups found.</p>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-surface-600">
              {groups.map((g) => {
                const busy = busyId === g.id;
                return (
                  <div key={g.id} className="px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-surface-50 truncate">
                            {g.name}
                          </p>
                          <Badge variant="outline" className="text-[10px]">
                            {g.member_count} member{g.member_count !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        {g.description && (
                          <p className="text-xs text-surface-300 truncate mt-0.5">
                            {g.description}
                          </p>
                        )}
                        <p className="text-xs text-surface-400">
                          Created {formatDate(g.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <ActionButton
                          onClick={() => handleDeleteGroup(g.id, g.name)}
                          busy={busy}
                          variant="danger"
                        >
                          {busy ? '...' : 'Delete'}
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </TabPanel>

      {/* Invitations Tab */}
      <TabPanel id="invitations" className="space-y-3">
        {invitations.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-8">No invitations found.</p>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-surface-600">
              {invitations.map((inv) => {
                const busy = busyId === inv.id;
                return (
                  <div key={inv.id} className="px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-surface-50 truncate">
                            {inv.email}
                          </p>
                          <Badge
                            variant={
                              inv.status === 'pending'
                                ? 'warning'
                                : inv.status === 'accepted'
                                  ? 'success'
                                  : inv.status === 'declined'
                                    ? 'error'
                                    : 'outline'
                            }
                            className="capitalize text-[10px]"
                          >
                            {inv.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-surface-300 truncate">
                          {inv.type === 'group' && inv.group_name
                            ? `Group: ${inv.group_name}`
                            : inv.type}
                        </p>
                        <p className="text-xs text-surface-400">
                          Sent {formatDate(inv.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <ActionButton
                          onClick={() => handleDeleteInvitation(inv.id)}
                          busy={busy}
                          variant="danger"
                        >
                          {busy ? '...' : 'Delete'}
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </TabPanel>
    </Tabs>
  );
}
