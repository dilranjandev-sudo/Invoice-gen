// Minimal service worker — makes PayRecord installable as a PWA.
// Network-first so finance data is always fresh; falls back to cache offline.
const CACHE = "payrecord-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache successful navigations/assets for offline fallback.
        if (res && res.ok && (req.mode === "navigate" || /\.(?:css|js|svg|png|woff2?)$/.test(new URL(req.url).pathname))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match("/dashboard")))
  );
});
