/* MyReels PWA Service Worker (admin-first) */

const CACHE_VERSION = "myreels-admin-cache-v1";
const CORE_ASSETS = [
  "/admin",
  "/admin/index.html",
  "/admin/admin.css",
  "/admin/admin.js",
  "/services-data.js",
  "/favicon.svg",
  "/favicon.png",
  "/assets/favicon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k === CACHE_VERSION ? null : caches.delete(k))))
      )
      .catch(() => {})
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  const accept = request.headers.get("accept") || "";
  return request.mode === "navigate" || accept.includes("text/html");
}

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!sameOrigin(url)) return;

  const cachePromise = (async () => {
    const cache = await caches.open(CACHE_VERSION);

    // Admin shell pages
    if (url.pathname.startsWith("/admin")) {
      if (isNavigationRequest(request)) {
        const cached = await cache.match("/admin/index.html");
        try {
          const network = await fetch(request);
          if (network && network.ok) cache.put(request, network.clone()).catch(() => {});
          return network;
        } catch {
          return cached || new Response("Offline", { status: 503, statusText: "Offline" });
        }
      }

      // Non-navigation assets under /admin (cache-first)
      const cached = await cache.match(request);
      if (cached) return cached;

      const res = await fetch(request);
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    }

    // For other assets: cache-first for common static files.
    const cached = await cache.match(request);
    if (cached) return cached;

    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  })();

  event.respondWith(cachePromise);
});

