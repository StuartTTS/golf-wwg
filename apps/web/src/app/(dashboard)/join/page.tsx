import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';
import JoinView from './join-view';

export const metadata = { title: 'Join a Game | Golf App' };

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  if (!featureFlags.shareCode) notFound();

  const { code } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <JoinView initialCode={(code ?? '').toUpperCase()} />;
}
