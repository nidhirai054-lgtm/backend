/**
 * SmartRide Service Worker
 * Handles background push notifications.
 *
 * Registration: navigator.serviceWorker.register('/sw.js')
 */

const CACHE_NAME = 'smartride-v1';

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'SmartRide', body: event.data.text() };
  }

  const title   = payload.title  || 'SmartRide';
  const options = {
    body:    payload.body  || '',
    icon:    '/vite.svg',
    badge:   '/vite.svg',
    vibrate: [200, 100, 200],
    tag:     payload.tag   || 'smartride-notification',
    data: {
      url: payload.url || '/',
      ...payload,
    },
    actions: payload.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ── Install / Activate (minimal — no aggressive caching) ────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
