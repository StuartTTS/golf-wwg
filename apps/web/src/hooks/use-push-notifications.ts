'use client';

import { useState, useEffect, useCallback } from 'react';
import { savePushSubscription, deletePushSubscription } from '@/lib/actions/push';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscription();
    } else {
      setIsLoading(false);
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported) return { error: 'Push notifications not supported' };

    try {
      setIsLoading(true);

      // Register service worker if not already
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setIsLoading(false);
        return { error: 'Notification permission denied' };
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setIsLoading(false);
        return { error: 'Push notifications not configured' };
      }

      // Convert VAPID key to Uint8Array
      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      const applicationServerKey = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        applicationServerKey[i] = rawData.charCodeAt(i);
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const json = subscription.toJSON();
      const result = await savePushSubscription({
        endpoint: json.endpoint!,
        keys: {
          p256dh: json.keys!.p256dh!,
          auth: json.keys!.auth!,
        },
      });

      if (result.error) {
        setIsLoading(false);
        return { error: result.error };
      }

      setIsSubscribed(true);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('Push subscribe error:', err);
      setIsLoading(false);
      return { error: 'Failed to enable notifications' };
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      setIsLoading(true);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await deletePushSubscription(endpoint);
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('Push unsubscribe error:', err);
      setIsLoading(false);
      return { error: 'Failed to disable notifications' };
    }
  }, []);

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
