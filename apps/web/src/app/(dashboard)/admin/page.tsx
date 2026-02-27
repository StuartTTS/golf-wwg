import { redirect } from 'next/navigation';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { AdminTabs } from './admin-tabs';

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Verify site admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_site_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_site_admin) redirect('/home');

  // Use service role client to bypass RLS for admin queries
  const adminClient = createServiceRoleClient();

  // Fetch all data for admin dashboard
  const [
    { data: users },
    { data: groups },
    { data: invitations },
    { count: roundCount },
    { count: courseCount },
  ] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id, display_name, email, is_site_admin, created_at, current_handicap_index')
      .order('created_at', { ascending: false }),
    adminClient
      .from('groups')
      .select('id, name, description, created_at, group_members(count)')
      .order('created_at', { ascending: false }),
    adminClient
      .from('invitations')
      .select('id, email, type, status, created_at, group_id, groups:group_id(name)')
      .order('created_at', { ascending: false }),
    adminClient.from('rounds').select('*', { count: 'exact', head: true }),
    adminClient.from('courses').select('*', { count: 'exact', head: true }),
  ]);

  const stats = {
    users: users?.length ?? 0,
    groups: groups?.length ?? 0,
    rounds: roundCount ?? 0,
    courses: courseCount ?? 0,
    pendingInvitations: invitations?.filter((i) => i.status === 'pending').length ?? 0,
    siteAdmins: users?.filter((u) => u.is_site_admin).length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">
          Site Admin
        </h1>
        <p className="mt-1 text-sm text-surface-300">
          Manage users, groups, and invitations across the platform.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Users', value: stats.users },
          { label: 'Groups', value: stats.groups },
          { label: 'Rounds', value: stats.rounds },
          { label: 'Courses', value: stats.courses },
          { label: 'Pending Invites', value: stats.pendingInvitations },
          { label: 'Site Admins', value: stats.siteAdmins },
        ].map((stat) => (
          <Card key={stat.label} padding="sm">
            <p className="text-xs text-surface-400 uppercase tracking-wide">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-surface-50 mt-1">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Tabbed Content */}
      <AdminTabs
        currentUserId={user.id}
        users={
          (users ?? []).map((u) => ({
            id: u.id,
            display_name: u.display_name,
            email: u.email,
            is_site_admin: u.is_site_admin,
            created_at: u.created_at,
            current_handicap_index: u.current_handicap_index,
          }))
        }
        groups={
          (groups ?? []).map((g) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            created_at: g.created_at,
            member_count:
              Array.isArray(g.group_members) && g.group_members[0]
                ? (g.group_members[0] as any).count
                : 0,
          }))
        }
        invitations={
          (invitations ?? []).map((inv) => ({
            id: inv.id,
            email: inv.email,
            type: inv.type,
            status: inv.status,
            created_at: inv.created_at,
            group_name: (inv.groups as any)?.name ?? null,
          }))
        }
      />
    </div>
  );
}
