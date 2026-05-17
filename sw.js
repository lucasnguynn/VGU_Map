/**
 * VGUMap Service Worker
 *
 * Goals:
 * - App shell: stale-while-revalidate for fast boot + silent refresh.
 * - Data JSON (updated every 5 minutes): network-first with cache fallback.
 * - Query-string-safe matching for cache-busted URLs (?v=timestamp).
 */

const SW_VERSION = '20260517091402';
const STATIC_CACHE = `vgumap-static-${SW_VERSION}`;
const DATA_CACHE = `vgumap-data-${SW_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './VGU MAP ALL.png',
  './VGU-Full-Color-logo-05-_1_.svg'
];

const DATA_PATHS = new Set(['/map_data.json', '/info_data.json', '/drive_data.json']);

function normalizedRequest(input) {
  const req = input instanceof Request ? input : new Request(input);
  const url = new URL(req.url);
  url.search = '';
  return new Request(url.toString(), {
    method: 'GET',
    headers: req.headers,
    mode: 'same-origin',
    credentials: req.credentials,
    redirect: req.redirect
  });
}

async function putIfOk(cacheName, request, response) {
  if (!response || !response.ok) return;
  
  // Guard: Only cache http/https requests, ignore chrome-extension:// and other schemes
  const requestUrl = request.url;
  if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
    return;
  }
  
  const cache = await caches.open(cacheName);
  await cache.put(normalizedRequest(request), response.clone());
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Use individual puts instead of addAll to avoid one missing file killing the install
    await Promise.allSettled(
      APP_SHELL.map(url =>
        fetch(url, { cache: 'no-store' })
          .then(res => { if (res.ok) return cache.put(url, res); })
          .catch(err => console.warn(`[SW] Pre-cache failed for ${url}:`, err))
      )
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((name) => {
      if (name !== STATIC_CACHE && name !== DATA_CACHE) return caches.delete(name);
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (DATA_PATHS.has(url.pathname)) {
    event.respondWith(networkFirstData(request));
    return;
  }

  if (isAppShellEntry(url.pathname)) {
    event.respondWith(networkFirstShell(request));
    return;
  }

  event.respondWith(staleWhileRevalidateStatic(request));
});

function isAppShellEntry(pathname) {
  return pathname === '/' || pathname === '/index.html';
}

async function networkFirstShell(request) {
  const cacheKey = normalizedRequest(request);
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(cacheKey, { ignoreSearch: true });

  try {
    const networkRes = await fetch(request, { cache: 'no-store' });
    if (networkRes && networkRes.ok) await putIfOk(STATIC_CACHE, request, networkRes);
    return networkRes;
  } catch (_) {
    if (cached) return cached;

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function staleWhileRevalidateStatic(request) {
  const cacheKey = normalizedRequest(request);
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(cacheKey, { ignoreSearch: true });

  const networkPromise = fetch(request)
    .then((res) => {
      void putIfOk(STATIC_CACHE, request, res);
      return res;
    })
    .catch(() => null);

  if (cached) {
    void networkPromise;
    return cached;
  }

  const networkRes = await networkPromise;
  if (networkRes) return networkRes;

  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

async function networkFirstData(request) {
  const cacheKey = normalizedRequest(request);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await putIfOk(DATA_CACHE, request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(cacheKey, { ignoreSearch: true });
    if (cached) return cached;

    return new Response(JSON.stringify({
      error: 'offline_data_unavailable',
      message: error?.message || 'Network error'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'REFRESH_DATA_CACHE') {
    event.waitUntil((async () => {
      const cache = await caches.open(DATA_CACHE);
      await Promise.all([...DATA_PATHS].map(async (path) => {
        try {
          const response = await fetch(`${self.location.origin}${path}`, { cache: 'no-store' });
          if (response.ok) await cache.put(normalizedRequest(`${self.location.origin}${path}`), response.clone());
        } catch (_) {
          // Ignore transient offline failures.
        }
      }));
    })());
  }
});
