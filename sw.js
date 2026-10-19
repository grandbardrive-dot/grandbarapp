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
      // Una pestaña que ya esté en esa misma pantalla se usa; si no, se abre una nueva.
      const destino = new URL(url, self.location.origin);
      for (const c of list) {
        let u = null; try { u = new URL(c.url); } catch (e) {}
        if (u && u.pathname === destino.pathname && 'focus' in c) {
          if (destino.hash && 'navigate' in c) return c.navigate(destino.href).then(w => (w || c).focus());
          return c.focus();
        }
      }
      return self.clients.openWindow(destino.href);
    })
  );
});
