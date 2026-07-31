// ─── Firebase Cloud Messaging Service Worker ─────────────────────────────────
// Para activar las notificaciones push:
// 1. Crear proyecto en https://console.firebase.google.com
// 2. Ir a Project Settings → Cloud Messaging → Web Push certificates
// 3. Reemplazar FIREBASE_CONFIG más abajo con los datos del proyecto
// 4. Reemplazar VAPID_KEY con la "Key pair" de Web Push certificates
//
// La función de envío (notify.js) debe ejecutarse diariamente en un cron
// o como Supabase Edge Function para disparar los pushes.

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ⚙️ REEMPLAZAR con los datos de tu proyecto Firebase
const FIREBASE_CONFIG = {
  apiKey:            "TU_API_KEY",
  authDomain:        "TU_PROYECTO.firebaseapp.com",
  projectId:         "TU_PROYECTO",
  storageBucket:     "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID",
};

firebase.initializeApp(FIREBASE_CONFIG);
const messaging = firebase.messaging();

// Manejar notificaciones cuando la app está en segundo plano
messaging.onBackgroundMessage(payload => {
  console.log('[FCM SW] Mensaje en background:', payload);
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || '🔔 GrandBar', {
    body:  body  || payload.data?.body,
    icon:  icon  || '/logo.png',
    badge: '/logo.png',
    data:  payload.data,
    actions: [
      { action: 'open', title: 'Abrir app' },
    ],
  });
});

// Click en la notificación → abrir la app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('compromisos.html') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/compromisos.html');
    })
  );
});
