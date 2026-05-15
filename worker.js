export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
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
    const fileId = url.searchParams.get("id");
    if (!fileId) {
      return new Response("Missing ?id= parameter", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
    }
    const apiKey = env.VGUMAP_3D_VIEW;
    if (!apiKey) {
      return new Response("VGUMAP_3D_VIEW not configured", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    }
    const targetUrl = `https://www.googleapis.com/drive/v3/files/ ${fileId}?alt=media&key=${apiKey}`;
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
  },
};
