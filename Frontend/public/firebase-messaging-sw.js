/* WorkNear push service worker.
 * Handles FCM web-push without loading the Firebase SDK (no CDN version coupling, tiny file).
 * FCM delivers JSON: { notification: {title, body}, data: {...}, fcmMessageId }.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { title: 'WorkNear', body: event.data ? event.data.text() : '' } };
  }
  const n = payload.notification || {};
  const data = payload.data || {};
  const title = n.title || data.title || 'WorkNear';
  const body = n.body || data.body || '';
  const link = data.link || (payload.fcmOptions && payload.fcmOptions.link) || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // App open and visible → let the page show an in-app toast instead of a system notification.
      const visible = clients.find((c) => c.visibilityState === 'visible');
      if (visible) {
        visible.postMessage({ type: 'wn-push', payload: { title, body, link } });
        return;
      }
      return self.registration.showNotification(title, {
        body,
        icon: '/favicon.webp',
        badge: '/favicon.webp',
        tag: payload.fcmMessageId || undefined,
        data: { link },
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.link) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.location.origin));
      if (existing) return existing.focus().then((c) => c.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
