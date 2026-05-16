export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ============================================================
    // PWA ASSETS: Strict No-Cache Headers for sw.js, index.html, /
    // This fixes the "Zombie SW" issue by ensuring browsers and CDN
    // always fetch fresh copies, allowing service worker update detection.
    // ============================================================
    const noCachePaths = ["/", "/index.html", "/sw.js"];
    if (noCachePaths.includes(pathname)) {
      const originResponse = await fetch(request, {
        cf: { cacheTtl: 0, cacheEverything: false },
      });

      const headers = new Headers(originResponse.headers);
      // Strict no-cache headers to disable ALL caching
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");
      headers.set("Access-Control-Allow-Origin", "*");

      return new Response(originResponse.body, {
        status: originResponse.status,
        headers,
      });
    }

    // ============================================================
    // JSON DATA FILES: Short-lived Cache (TTL: 60s) for Rate Limit Protection
    // - Protects Google Apps Script origin from rate-limiting spikes
    // - Uses Cloudflare Cache API with 60-second TTL
    // - Falls back to network on cache miss or error
    // ============================================================
    const jsonPaths = ["/map_data.json", "/info_data.json", "/drive_data.json"];
    if (jsonPaths.some(p => pathname.startsWith(p))) {
      const CACHE_TTL_SECONDS = 60;
      const cacheKey = new Request(`https://vgumap-json-cache${pathname}`, { method: "GET" });
      const cache = caches.default;

      // Try to serve from cache first
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const headers = new Headers(cachedResponse.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("X-Cache", "HIT");
        headers.set("Age", String(Math.floor((Date.now() - cachedResponse.headers.get('X-Cache-Timestamp')) / 1000)));
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers,
        });
      }

      // Cache miss - fetch from origin
      try {
        const originResponse = await fetch(request, {
          cf: { cacheTtl: 0, cacheEverything: false },
        });

        if (!originResponse.ok) {
          throw new Error(`HTTP ${originResponse.status}`);
        }

        // Clone response for caching
        const responseToCache = await originResponse.clone();
        const headers = new Headers(responseToCache.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=30`);
        headers.set("X-Cache", "MISS");
        headers.set("X-Cache-Timestamp", String(Date.now()));

        const finalResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          headers,
        });

        // Store in cache asynchronously
        ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));

        return finalResponse;
      } catch (error) {
        console.error(`[Worker] JSON fetch error for ${pathname}:`, error.message);
        
        // Return error response with CORS headers
        return new Response(JSON.stringify({
          error: 'fetch_failed',
          message: error.message
        }), {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    // ============================================================
    // 3D MODEL CACHING: Existing Google Drive File Proxy
    // Keeps aggressive caching for large GLB/GLTF models (unchanged logic)
    // ============================================================
    const fileId = url.searchParams.get("id");
    if (fileId) {
      const apiKey = env.VGUMAP_3D_VIEW;
      if (!apiKey) {
        return new Response("VGUMAP_3D_VIEW not configured", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
      }
      const targetUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
      const cacheKey = new Request(`https://vgumap-3d-cache/${fileId}`, { method: "GET" });
      const cache = caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("X-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers });
      }
      const driveResponse = await fetch(targetUrl, { headers: { "Accept-Encoding": "identity" } });
      if (!driveResponse.ok) {
        return new Response(`Google Drive error: ${driveResponse.status}`, { status: driveResponse.status, headers: { "Access-Control-Allow-Origin": "*" } });
      }
      const body = await driveResponse.arrayBuffer();
      const headers = new Headers();
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Content-Type", driveResponse.headers.get("content-type") || "model/gltf-binary");
      headers.set("Cache-Control", "public, max-age=2592000");
      headers.set("X-Cache", "MISS");
      const responseToCache = new Response(body, { status: 200, headers });
      ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));
      return new Response(body, { status: 200, headers });
    }

    // Default: pass-through for other assets (CSS, JS, images, etc.)
    return fetch(request);
  },
};
