import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
} from '@/components/ui';

export const metadata = {
  title: 'My Groups | Golf App',
};

export default async function GroupsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships, error } = await supabase
    .from('group_members')
    .select(`
      role,
      group:groups (
        id,
        name,
        description,
        created_at,
        group_members (count)
      )
    `)
    .eq('user_id', user?.id ?? '');

  const groups = memberships
    ?.map((m) => ({
      ...(m.group as any),
      role: m.role,
      memberCount: (m.group as any)?.group_members?.[0]?.count ?? 0,
    }))
    .filter(Boolean) ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-surface-50">
            My Groups
          </h1>
          <p className="mt-1 text-sm text-surface-300">
            Manage your golf groups and see recent activity.
          </p>
        </div>
        <Link href="/groups/new">
          <Button>Create Group</Button>
        </Link>
      </div>

      {/* Groups List */}
      {error ? (
        <Card>
          <CardHeader>
            <CardDescription className="text-center py-6 text-red-500">
              Failed to load groups. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardHeader className="text-center py-12">
            <CardTitle className="text-lg">No groups yet</CardTitle>
            <CardDescription className="mt-2">
              Create a group to start tracking scores with your friends.
            </CardDescription>
            <div className="mt-6">
              <Link href="/groups/new">
                <Button>Create Your First Group</Button>
              </Link>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="block">
              <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {group.role}
                    </Badge>
                  </div>
                  {group.description && (
                    <CardDescription className="line-clamp-2">
                      {group.description}
                    </CardDescription>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-sm text-surface-300">
                    <span>
                      {group.memberCount}{' '}
                      {group.memberCount === 1 ? 'member' : 'members'}
                    </span>
                    <span>
                      Created{' '}
                      {new Date(group.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
