/* Baguio Base Camp scanner shell cache.
 * - /_next/static: cache-first (immutable hashed assets)
 * - /admin/scan*: network-first, fall back to the last good copy when offline
 * - everything else: network only
 */
const VERSION = "bbc-sw-v1";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  const isScanPage = req.mode === "navigate" && url.pathname.startsWith("/admin/scan");
  const isRsc = url.pathname.startsWith("/admin/scan") && req.headers.get("RSC") === "1";
  if (isScanPage || isRsc) {
    e.respondWith(
      caches.open(SHELL).then(async (c) => {
        try {
          const res = await fetch(req);
          if (res.ok) c.put(req, res.clone());
          return res;
        } catch {
          const hit = await c.match(req, { ignoreSearch: true });
          return hit ?? new Response("Offline and no cached scanner page. Open this page once while online.", { status: 503, headers: { "content-type": "text/plain" } });
        }
      }),
    );
  }
});
