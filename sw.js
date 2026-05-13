/**
 * VGUMap Service Worker
 * Production-ready PWA caching strategy
 * 
 * Caching Strategies:
 * - Cache First: Static assets (HTML, CSS, JS, Leaflet libraries)
 * - Network First: Dynamic JSON data files (map_data.json, info_data.json, drive_data.json)
 */

const CACHE_NAME = 'vgumap-v1';
const STATIC_CACHE = 'vgumap-static-v1';
const DATA_CACHE = 'vgumap-data-v1';

// Static assets to cache immediately (Cache First strategy)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/config.js',
  './js/data-service.js',
  './js/renderer.js',
  './js/room-service.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'
];

// Dynamic JSON files (Network First strategy)
const DATA_URLS = [
  './map_data.json',
  './info_data.json',
  './drive_data.json'
];

// ═══════════════════════════════════════════════════════════════
// INSTALL EVENT - Cache static assets
// ═══════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// ═══════════════════════════════════════════════════════════════
// ACTIVATE EVENT - Clean up old caches
// ═══════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches that don't match current versions
            if (cacheName !== STATIC_CACHE && cacheName !== DATA_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        // Claim all clients immediately
        return self.clients.claim();
      })
  );
});

// ═══════════════════════════════════════════════════════════════
// FETCH EVENT - Handle requests with appropriate strategies
// ═══════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Check if this is a dynamic JSON data request
  const isDataRequest = DATA_URLS.some(dataUrl => {
    const fullDataUrl = new URL(dataUrl, self.location.origin).pathname;
    return requestUrl.pathname === fullDataUrl || requestUrl.pathname.endsWith(dataUrl.replace('./', ''));
  });
  
  // Also check for cache-busted URLs (e.g., map_data.json?v=1234567890)
  const isCacheBustedDataRequest = DATA_URLS.some(dataUrl => {
    const baseName = dataUrl.replace('./', '');
    return requestUrl.pathname.includes(baseName);
  });
  
  if (isDataRequest || isCacheBustedDataRequest) {
    // NETWORK FIRST strategy for dynamic JSON data
    // Always try to fetch from network first, fall back to cache
    event.respondWith(networkFirstStrategy(event.request));
  } else {
    // CACHE FIRST strategy for static assets
    // Serve from cache, fall back to network
    event.respondWith(cacheFirstStrategy(event.request));
  }
});

// ═══════════════════════════════════════════════════════════════
// CACHE FIRST STRATEGY
// For static assets (HTML, CSS, JS, images, fonts)
// ═══════════════════════════════════════════════════════════════
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Cache HIT:', request.url);
      return cachedResponse;
    }
    
    console.log('[SW] Cache MISS, fetching:', request.url);
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache First failed:', error);
    // Return offline fallback if available
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ═══════════════════════════════════════════════════════════════
// NETWORK FIRST STRATEGY
// For dynamic JSON data files (map_data.json, info_data.json, drive_data.json)
// ═══════════════════════════════════════════════════════════════
async function networkFirstStrategy(request) {
  try {
    // Try to fetch from network first
    console.log('[SW] Network First - Fetching:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone and cache the response for future use
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Network success, cached:', request.url);
      return networkResponse;
    }
    
    // If network response is not OK, throw to trigger cache fallback
    throw new Error(`Network response not OK: ${networkResponse.status}`);
    
  } catch (error) {
    console.warn('[SW] Network failed, trying cache:', request.url, error.message);
    
    // Network failed, try to get from cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Cache fallback successful:', request.url);
      return cachedResponse;
    }
    
    // No cache available, return error response
    console.error('[SW] No cache available for:', request.url);
    return new Response(JSON.stringify({ error: 'No data available', message: error.message }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLER - For manual cache updates
// ═══════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_DATA_CACHE') {
    console.log('[SW] Clearing data cache...');
    event.waitUntil(
      caches.delete(DATA_CACHE).then(() => {
        console.log('[SW] Data cache cleared');
      })
    );
  }
});
