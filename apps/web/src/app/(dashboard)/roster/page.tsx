import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';
import { getRoster, suggestRecentPlayers } from '@/lib/actions/roster';
import { getRosterGroups } from '@/lib/actions/roster-groups';
import RosterView from './roster-view';

export const metadata = { title: 'My Roster | Golf App' };

export default async function RosterPage() {
  if (!featureFlags.roster) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [roster, suggestions, groups] = await Promise.all([
    getRoster(),
    suggestRecentPlayers(),
    getRosterGroups(),
  ]);

  return (
    <RosterView initialRoster={roster} suggestions={suggestions} initialGroups={groups} />
  );
}
