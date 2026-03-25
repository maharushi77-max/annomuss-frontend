// firebase-messaging-sw.js
// Annomuss Push Notification Service Worker
// Handles background push notifications when the app is closed

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ── Firebase config ── (same as frontend config)
// IMPORTANT: Replace these with your actual Firebase config values
// Get them from: Firebase Console → Project Settings → General → Your apps → Web app
firebase.initializeApp({
  apiKey: "AIzaSyBP8ld3jaa4Mas7bCmSLhe6p-d3edJpzY8",
  authDomain: "annomuss-app.firebaseapp.com",
  projectId: "annomuss-app",
  storageBucket: "annomuss-app.firebasestorage.app",
  messagingSenderId: "503827912893",
  appId: "1:503827912893:web:4bab6708a692fa78027fd4",
  measurementId: "G-ZSXSQWYYK8",
});

const messaging = firebase.messaging();

// ── Background message handler ──
// This fires when app is in background/closed
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background push received:', payload);

  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  // Build notification
  const notifTitle = title || 'Annomuss 🎭';
  const notifBody  = body  || 'You have a new notification';

  const options = {
    body:    notifBody,
    icon:    '/icon-192.png',
    badge:   '/badge-72.png',
    tag:     data.type || 'annomuss',        // groups same-type notifications
    renotify: true,
    vibrate: [200, 100, 200],
    data:    { url: getUrlForType(data.type), ...data },
    actions: getActions(data.type),
  };

  self.registration.showNotification(notifTitle, options);
});

// ── Notification click handler ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes('annomuss') && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: event.notification.data });
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Helper: URL based on notification type ──
function getUrlForType(type) {
  switch (type) {
    case 'message':        return '/messages.html';
    case 'friend_request': return '/dashboard.html#social-requests';
    case 'like':
    case 'comment':        return '/dashboard.html#feed';
    default:               return '/dashboard.html';
  }
}

// ── Helper: Action buttons ──
function getActions(type) {
  switch (type) {
    case 'message':
      return [{ action: 'reply', title: '💬 Open' }];
    case 'friend_request':
      return [{ action: 'view', title: '🤝 View' }];
    default:
      return [{ action: 'open', title: '👀 Open' }];
  }
}
