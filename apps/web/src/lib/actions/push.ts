'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function savePushSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: 'user_id,endpoint' }
    );

  if (error) {
    console.error('Save push subscription error:', error);
    return { error: 'Failed to save notification settings' };
  }

  return { success: true };
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('Delete push subscription error:', error);
    return { error: 'Failed to remove notification settings' };
  }

  return { success: true };
}
