/* MyReels PWA Service Worker (admin-first) */

const CACHE_VERSION = "myreels-admin-cache-v31";
const CORE_ASSETS = [
  "/admin",
  "/admin/index.html",
  "/admin/admin.css",
  "/admin/admin.js",
  "/services-data.js",
  "/stay-reel.js",
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

  // Public reel pages stay fresh. Never cache the worker itself, or updates get stuck.
  if (
    url.pathname === "/sw.js" ||
    url.pathname === "/stay-reel.js" ||
    url.pathname === "/reel" ||
    url.pathname.startsWith("/myairbnbreels/") ||
    url.pathname.startsWith("/reel.") ||
    url.pathname === "/api/reel-page" ||
    url.pathname === "/api/reel-config" ||
    url.pathname === "/api/reel-thumb" ||
    url.pathname === "/upsell" ||
    url.pathname === "/upsell.js" ||
    url.pathname === "/upsell.css" ||
    url.pathname.startsWith("/upsell.") ||
    url.pathname === "/review" ||
    url.pathname === "/review.css" ||
    url.pathname === "/api/review" ||
    url.pathname === "/local-sample.mp4"
  ) {
    return;
  }

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

