// GrandBar Hub · Service Worker para notificaciones push (recordatorios de agenda)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: 'GrandBar', body: (event.data && event.data.text()) || '' }; }
  const title = data.title || 'GrandBar';
  const opts = {
    body: data.body || '',
    icon: data.icon || '/assets/apple-touch-icon.png',
    badge: '/assets/apple-touch-icon.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/agenda.html' },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/agenda.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('agenda') && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
