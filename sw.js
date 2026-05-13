/**
 * VGUMap Service Worker
 *
 * - Cache-first for static shell assets
 * - Network-first for JSON data assets
 * - Query-string-safe caching: ignoreSearch + normalized cache keys
 */

const VERSION = 'v3';
const STATIC_CACHE = `vgumap-static-${VERSION}`;
const DATA_CACHE = `vgumap-data-${VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './VGU MAP ALL.png',
  './VGU-Full-Color-logo-05-_1_.svg'
];

const DATA_PATHS = new Set(['/map_data.json', '/info_data.json', '/drive_data.json']);

function toCacheKey(request) {
  const url = new URL(request.url);
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(STATIC_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => (name !== STATIC_CACHE && name !== DATA_CACHE ? caches.delete(name) : Promise.resolve())));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (DATA_PATHS.has(url.pathname)) {
    event.respondWith(networkFirstData(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cacheKey = toCacheKey(request);
  const cached = await caches.match(cacheKey, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (_) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirstData(request) {
  const cacheKey = toCacheKey(request);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(DATA_CACHE);
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(cacheKey, { ignoreSearch: true });
    if (cached) return cached;

    return new Response(JSON.stringify({ error: 'No data available offline', message: error.message }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
