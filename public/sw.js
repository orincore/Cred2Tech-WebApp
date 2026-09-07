// Cred2Tech offline-fallback service worker.
//
// Sole job: when a full-page navigation (address bar, refresh, back/forward)
// fails because the network is unreachable, serve our own branded
// offline.html instead of the browser's built-in "no internet" page (the
// Chrome dino game and equivalents in other browsers). Nothing else.
//
// Deliberately does NOT precache or intercept the SPA's own JS/CSS chunks,
// API calls, or any other asset — those chunks are content-hashed per
// deploy (see src/components/ErrorBoundary.jsx's chunk-reload handling), so
// caching them here would risk this service worker itself serving a stale
// build once the user is back online. This worker only ever knows about
// offline.html and the couple of images it needs to render.

const CACHE_VERSION = 'c2t-offline-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/logos/favicon.png',
  '/logos/white-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Take over immediately rather than waiting for every open tab of the
      // previous SW (if any) to close — there is no app functionality to
      // preserve across the swap, only this offline fallback.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Real page navigations: always prefer the live network response (so a
  // working connection still gets the current app/build, including a real
  // 4xx/5xx from a reachable server) and fall back to the cached offline
  // page only when the request itself fails outright.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // The offline page's own assets (its logo images) — serve from cache only
  // if the network is actually down; otherwise this is a no-op and the
  // browser handles the request as if this worker didn't exist.
  let path;
  try {
    path = new URL(request.url).pathname;
  } catch {
    return;
  }
  if (PRECACHE_URLS.includes(path)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});

// ─── Push notifications ─────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    // Fall back to plain text if the payload isn't JSON.
    data = { title: 'Cred2Tech', body: event.data.text() };
  }

  const title = String(data.title || 'New Notification').trim();
  const body = String(data.body || '').trim();
  const { action_url: actionUrl, notification_type: notificationType = 'ALERT' } = data;

  const options = {
    body,
    icon: '/logos/favicon.png',
    badge: '/logos/favicon.png',
    data: { action_url: actionUrl, notification_type: notificationType },
    dir: 'auto',
    lang: 'en-IN',
    vibrate: [100, 50, 100],
    tag: `notif-${data.notification_id || Date.now()}`,
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action_url: actionUrl } = event.notification.data || {};
  const isExternalUrl = /^https?:\/\//i.test(actionUrl || '');

  event.waitUntil(
    // Try to focus an open window/tab of this app first.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (isExternalUrl) return self.clients.openWindow(actionUrl);
      // Find a window that isn't already navigating.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && !client.url.includes('/login')) {
          client.focus();
          if (actionUrl) client.navigate(actionUrl);
          return;
        }
      }
      // No open window — open a new one.
      return self.clients.openWindow(actionUrl || '/');
    })
  );
});
