import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Only inject the Firebase block when config is actually present so the SW
  // never enters a broken state (which would intercept all page fetches and
  // make them throw TypeError: Failed to fetch).
  const hasConfig = Boolean(config.apiKey && config.messagingSenderId && config.appId);

  const sw = `
// Take control immediately so there is never a gap where an old broken SW
// is still intercepting fetches while the new one is waiting.
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// Passthrough fetch handler — must be registered BEFORE Firebase Messaging
// sets up its own handler so it wins the race and never swallows page requests.
self.addEventListener('fetch', function(event) {
  var req = event.request;
  // Only intercept same-origin or firebase push endpoints; everything else
  // falls through to the network without going through Firebase.
  var url = req.url;
  var isSameOrigin = url.startsWith(self.location.origin);
  var isPushEndpoint = url.includes('fcm.googleapis.com') ||
                       url.includes('fcmregistrations.googleapis.com') ||
                       url.includes('firebase.googleapis.com');
  if (!isSameOrigin && !isPushEndpoint) {
    // Cross-origin non-Firebase request — let the browser handle it directly.
    return;
  }
  // Same-origin requests: always pass through to the network.
  // Firebase push endpoints: also pass through (Firebase compat handles these
  // via its own push/message listeners, not the fetch handler).
  event.respondWith(
    fetch(req).catch(function() {
      // Network failure — return an empty 503 so the page gets a real HTTP
      // response rather than a TypeError that looks like "Failed to fetch".
      return new Response(null, { status: 503, statusText: 'Service Unavailable' });
    })
  );
});

${hasConfig ? `
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

try {
  firebase.initializeApp(${JSON.stringify(config)});
  var messaging = firebase.messaging();
} catch (e) {
  // Firebase init failed — push notifications won't work but the SW stays healthy.
}

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var urlToOpen = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf(urlToOpen) !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
` : `
// Firebase config missing — SW active but push notifications disabled.
`}
`;

  return new NextResponse(sw, {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}