// Cred2Tech service worker: installable-app shell, low-bandwidth caching, offline fallback, web push.
//
// Build step: vite.config.js (c2tServiceWorker plugin) replaces the two markers below in dist/sw.js with this
// release's file list, so every deploy produces a new sw.js and browsers pick it up. In dev the markers stay
// as they are, PRECACHE is empty, and this worker only does what it always did (offline page + push).
//
// What it caches, and why it is safe:
//   - /assets/*  content-hashed JS/CSS/fonts. Same URL = same bytes forever, so cache-first is always correct. They
//                live in one persistent cache so a tab still running the previous release can keep loading its
//                lazy chunks after a new release activates.
//   - the shell  index.html, offline.html, manifest, icons, logos, app fonts. Re-cached as one consistent set per
//                release (index.html always matches the chunks that were cached with it).
//   - 3rd-party  Google Fonts CSS + font files (Material Symbols draws the app's icons, so they must survive offline).
// What it NEVER touches: /api/*, /socket.io, /version.json (OfflineOverlay uses it to prove real connectivity),
// non-GET requests, and anything cross-origin except the fonts above. No user data is ever stored here.

const BUILD = '__C2T_BUILD__';
const PRECACHE = /*__C2T_PRECACHE__*/ []; // [{ url, kind: 'shell' | 'asset', core: boolean }]
const PRECACHING = PRECACHE.length > 0;

const SHELL_CACHE = `c2t-shell-${BUILD}`;
const ASSET_CACHE = 'c2t-assets-v1';
const STATIC_CACHE = 'c2t-static-v1';
const FONT_CACHE = 'c2t-gfonts-v1';
const KEEP_CACHES = [SHELL_CACHE, ASSET_CACHE, STATIC_CACHE, FONT_CACHE];

const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/index.html';
const LEGACY_SHELL = [OFFLINE_URL, '/logos/favicon.png', '/logos/white-logo.png', '/logos/black-logo.png']; // dev / no-manifest fallback
const NAV_TIMEOUT_MS = 3500;       // slower than this and an installed shell is shown instead of waiting
const MAX_ASSET_ENTRIES = 300;
const TRIM_ABOVE = 400;

const isHtml = (res) => /text\/html/i.test(res.headers.get('content-type') || '');
const cacheable = (res) => res && (res.ok || res.type === 'opaque');

// ─── Install / activate ─────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    if (!PRECACHING) {
      await shell.addAll(LEGACY_SHELL);
    } else {
      const assets = await caches.open(ASSET_CACHE);
      const saveData = !!(self.navigator && self.navigator.connection && self.navigator.connection.saveData);
      const put = async (entry) => {
        const cache = entry.kind === 'asset' ? assets : shell;
        if (entry.kind === 'asset' && (await cache.match(entry.url, { ignoreVary: true }))) return; // hashed: already have these exact bytes
        const res = await fetch(new Request(entry.url, { cache: 'reload' }));
        if (!res.ok || (entry.kind === 'asset' && isHtml(res))) throw new Error(`precache failed: ${entry.url} ${res.status}`);
        await cache.put(entry.url, res);
      };
      // Anything the first screen needs must succeed, or this install fails and is retried later (never a half-cached shell).
      await Promise.all(PRECACHE.filter((e) => e.kind === 'shell' || e.core).map(put));
      // The rest (other pages' chunks) is best-effort, a few at a time so it never saturates a slow link.
      // On Data Saver they are cached on first use instead.
      if (!saveData) {
        const rest = PRECACHE.filter((e) => e.kind === 'asset' && !e.core);
        let next = 0;
        const worker = async () => { while (next < rest.length) { const e = rest[next++]; try { await put(e); } catch { /* cached on first use instead */ } } };
        await Promise.all([worker(), worker(), worker()]);
      }
    }
    // Take over immediately rather than waiting for every open tab to close.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !KEEP_CACHES.includes(n)).map((n) => caches.delete(n)));
    // Hashed chunks from older releases are kept for tabs still running them, but not forever.
    try {
      const cache = await caches.open(ASSET_CACHE);
      const keys = await cache.keys();
      if (keys.length > TRIM_ABOVE) {
        const current = new Set(PRECACHE.map((e) => e.url));
        const stale = keys.filter((r) => !current.has(new URL(r.url).pathname));
        for (const r of stale.slice(0, Math.max(0, keys.length - MAX_ASSET_ENTRIES))) await cache.delete(r);
      }
    } catch { /* trimming is best-effort */ }
    await self.clients.claim();
  })());
});

// ─── Fetch strategies ───────────────────────────────────────────────────────────

async function putIfOk(cacheName, request, response) {
  try {
    if (!cacheable(response)) return;
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch { /* quota or opaque edge cases: caching is an optimisation only */ }
}

async function cacheFirstAsset(event) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(event.request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(event.request);
  // A host that rewrites unknown paths to index.html answers a deleted chunk with 200 text/html. Never cache that as a script.
  if (res.ok && !isHtml(res)) event.waitUntil(putIfOk(ASSET_CACHE, event.request, res.clone()));
  return res;
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(event.request, { ignoreVary: true });
  const refresh = fetch(event.request).then((res) => { if (cacheable(res) && !(res.ok && isHtml(res))) cache.put(event.request, res.clone()).catch(() => {}); return res; });
  if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
  return refresh;
}

async function cacheFirst(event, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(event.request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(event.request);
  event.waitUntil(putIfOk(cacheName, event.request, res.clone()));
  return res;
}

async function handleNavigation(event) {
  const request = event.request;
  const path = new URL(request.url).pathname;
  // Only extension-less app routes can be answered with the SPA shell. Static pages (/legal/...) cannot.
  const isAppRoute = !/\.[a-z0-9]{1,6}$/i.test(path) && !path.startsWith('/legal/');

  const shell = PRECACHING && isAppRoute ? await caches.match(SHELL_URL, { cacheName: SHELL_CACHE, ignoreVary: true }) : undefined;
  try {
    if (!shell) return await fetch(request); // nothing to fall back to: wait for the network like a normal page
    // An installed shell exists: a slow network must not leave the user staring at a blank screen.
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), NAV_TIMEOUT_MS); });
    const network = fetch(request).then((res) => { clearTimeout(timer); return res; });
    const winner = await Promise.race([network, timeout]);
    if (winner) return winner;
    event.waitUntil(network.catch(() => {})); // let the request finish so the HTTP cache is warm for the next open
    return shell;
  } catch {
    if (shell) return shell; // offline: the app boots from cache; its own OfflineOverlay explains the connection state
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

const STATIC_PATH = /^\/(?:logos|icons|fonts|lottie)\/.+\.(?:png|jpe?g|svg|webp|ico|otf|ttf|woff2?|json|lottie)$/i;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  if (request.mode === 'navigate') {
    // API/data documents opened in a tab (PDFs, exports) and the health endpoints are never a page: leave them alone.
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/version.json' || url.pathname === '/healthz') return;
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.origin === 'https://fonts.googleapis.com') { event.respondWith(staleWhileRevalidate(event, FONT_CACHE)); return; }
  if (url.origin === 'https://fonts.gstatic.com') { event.respondWith(cacheFirst(event, FONT_CACHE)); return; }
  if (url.origin !== self.location.origin) return;

  const p = url.pathname;
  if (p.startsWith('/api/') || p.startsWith('/socket.io') || p === '/version.json' || p === '/sw.js') return;
  if (!PRECACHING) {
    // Dev / unreplaced build: only the offline page's own images, as before.
    if (LEGACY_SHELL.includes(p)) event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  if (p.startsWith('/assets/')) { event.respondWith(cacheFirstAsset(event)); return; }
  if (p === '/manifest.webmanifest' || STATIC_PATH.test(p)) {
    event.respondWith((async () => {
      const shelled = await caches.match(request, { cacheName: SHELL_CACHE, ignoreVary: true });
      return shelled || staleWhileRevalidate(event, STATIC_CACHE);
    })());
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
  // A white-label org's pushes carry its own icon (same-site image URL); the main app sends none and keeps ours.
  const icon = typeof data.icon === 'string' && /^https?:\/\//.test(data.icon) ? data.icon : '/logos/favicon.png';

  const options = {
    body,
    icon,
    badge: icon,
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
