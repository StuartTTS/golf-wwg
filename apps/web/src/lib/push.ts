import webpush from 'web-push';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Configure VAPID
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:stuart@trophytechsupport.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send push notifications to specific users.
 * Silently skips users without push subscriptions.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured, skipping push notifications');
    return;
  }

  const supabase = createServiceRoleClient();

  // Fetch all subscriptions for these users
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (!subscriptions || subscriptions.length === 0) return;

  const payloadStr = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payloadStr
        );
      } catch (err: any) {
        // If subscription is expired/invalid (410 Gone), clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }
        throw err;
      }
    })
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`Push notifications: ${failed.length}/${subscriptions.length} failed`);
  }
}
