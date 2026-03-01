import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
} from '@/components/ui';

export const metadata = {
  title: 'Start a Round | Golf App',
};

export default async function NewRoundPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group:groups(id, name)')
    .eq('user_id', user.id);

  const groups =
    memberships
      ?.map((m) => m.group as unknown as { id: string; name: string })
      .filter(Boolean) ?? [];

  // Single group — skip the picker
  if (groups.length === 1) {
    redirect(`/groups/${groups[0].id}/rounds/new`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">
          Start a Round
        </h1>
        <p className="mt-1 text-sm text-surface-300">
          Choose a group to create a new round in.
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardHeader className="text-center py-12">
            <CardTitle className="text-lg">No groups yet</CardTitle>
            <CardDescription className="mt-2">
              You need to join or create a group before starting a round.
            </CardDescription>
            <div className="mt-6">
              <Link href="/groups/new">
                <Button>Create a Group</Button>
              </Link>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}/rounds/new`}
              className="block"
            >
              <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
