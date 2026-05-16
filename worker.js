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
    // JSON DATA FILES: Network-First with strict no-cache headers
    // - Forces Cloudflare CDN and browsers to always fetch fresh data
    // - Appends cache-busting timestamp to prevent any stale responses
    // ============================================================
    const jsonPaths = ["/map_data.json", "/info_data.json", "/drive_data.json"];
    if (jsonPaths.some(p => pathname.startsWith(p))) {
      // Parse the request URL and append a cache-busting timestamp
      const url = new URL(request.url);
      url.searchParams.set('_cb', Date.now().toString());
      const cacheBustedRequest = new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
        redirect: request.redirect,
        mode: request.mode
      });
      
      const originResponse = await fetch(cacheBustedRequest, {
        cf: { cacheTtl: 0, cacheEverything: false },
      });

      const headers = new Headers(originResponse.headers);
      // Strict no-store headers to disable ALL caching at CDN and browser level
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");
      headers.set("Access-Control-Allow-Origin", "*");

      return new Response(originResponse.body, {
        status: originResponse.status,
        headers,
      });
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
