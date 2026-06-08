import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

/**
 * usePushNotifications
 *
 * Manages the full Web Push subscription lifecycle:
 *   1. Register the service worker (sw.js)
 *   2. Fetch the VAPID public key from the backend
 *   3. Subscribe via PushManager
 *   4. POST the subscription to /api/notifications/subscribe
 *
 * Usage:
 *   const { isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications();
 */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

const usePushNotifications = () => {
  const [isSubscribed,  setIsSubscribed]  = useState(false);
  const [isSupported,   setIsSupported]   = useState(false);
  const [registration,  setRegistration]  = useState(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [error,         setError]         = useState(null);

  // Check browser support and register SW on mount
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    if (!supported) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        setRegistration(reg);
        // Check if already subscribed
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        setIsSubscribed(!!sub);
      })
      .catch((err) => {
        console.error('[Push] SW registration failed:', err);
      });
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || !registration) return;
    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied');
        return;
      }

      // Fetch VAPID public key from backend
      const keyRes = await api.get('/notifications/vapid-public-key');
      const vapidPublicKey = keyRes.data.public_key;

      if (!vapidPublicKey) {
        setError('VAPID public key not configured on server');
        return;
      }

      // Subscribe via PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const subJson = subscription.toJSON();

      // Send to backend
      await api.post('/notifications/subscribe', {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth:   subJson.keys.auth,
        },
      });

      setIsSubscribed(true);
      console.log('[Push] Subscribed successfully');
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      setError(err.message || 'Failed to subscribe to push notifications');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, registration]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;
    setIsLoading(true);

    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        const subJson = sub.toJSON();
        await sub.unsubscribe();
        await api.delete('/notifications/unsubscribe', {
          data: { endpoint: subJson.endpoint },
        });
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [registration]);

  return { isSubscribed, isSupported, isLoading, error, subscribe, unsubscribe };
};

export default usePushNotifications;
