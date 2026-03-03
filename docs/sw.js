const SW_VERSION = 'v3';
const STATIC_CACHE = `bfm-static-${SW_VERSION}`;
const RUNTIME_CACHE = `bfm-runtime-${SW_VERSION}`;
const OUTBOX_SYNC_TAG = 'bfm-outbox-sync';

const SW_PATH = self.location.pathname;
const BASE_URL = SW_PATH.endsWith('/sw.js')
  ? SW_PATH.slice(0, -'sw.js'.length)
  : '/';

const toAbsoluteUrl = (path) => new URL(path, self.location.origin).toString();

const PRECACHE_URLS = [
  BASE_URL,
  `${BASE_URL}index.html`,
  `${BASE_URL}manifest.webmanifest`,
  `${BASE_URL}apple-touch-icon.png`,
  `${BASE_URL}pwa-192x192.png`,
  `${BASE_URL}pwa-512x512.png`,
  `${BASE_URL}pwa-maskable-192x192.png`,
  `${BASE_URL}pwa-maskable-512x512.png`,
].map(toAbsoluteUrl);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = String(event.data.title || 'Badminton App').trim() || 'Badminton App';
    const options = event.data.options && typeof event.data.options === 'object'
      ? event.data.options
      : {};
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

const broadcastMessage = async (message) => {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => {
    client.postMessage(message);
  });
};

self.addEventListener('sync', (event) => {
  if (event.tag !== OUTBOX_SYNC_TAG) return;
  event.waitUntil(broadcastMessage({ type: 'OUTBOX_SYNC', tag: OUTBOX_SYNC_TAG }));
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== OUTBOX_SYNC_TAG) return;
  event.waitUntil(broadcastMessage({ type: 'OUTBOX_SYNC', tag: OUTBOX_SYNC_TAG }));
});

const putInCache = async (cacheName, request, response) => {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

const serveNavigation = async (event) => {
  const indexUrl = toAbsoluteUrl(`${BASE_URL}index.html`);
  try {
    const networkResponse = await fetch(event.request);
    await putInCache(STATIC_CACHE, indexUrl, networkResponse);
    return networkResponse;
  } catch {
    const cachedIndex = await caches.match(indexUrl);
    if (cachedIndex) return cachedIndex;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};

const serveStatic = async (event) => {
  const cached = await caches.match(event.request);
  const networkFetch = fetch(event.request)
    .then((response) => {
      void putInCache(RUNTIME_CACHE, event.request, response);
      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
};

const isStaticRequest = (request) => {
  const destination = request.destination;
  return (
    destination === 'script'
    || destination === 'style'
    || destination === 'image'
    || destination === 'font'
    || destination === 'manifest'
    || destination === 'worker'
  );
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(serveNavigation(event));
    return;
  }

  if (isStaticRequest(request)) {
    event.respondWith(serveStatic(event));
  }
});
