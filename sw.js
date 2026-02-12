const CACHE_NAME = "cloze-pwa-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  // IMPORTANT: don't auto-skipWaiting here, or your "Refresh" button often has
  // no waiting worker to activate.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k)))
      );
      await self.clients.claim(); // takes control of pages ASAP [page:0]
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        if (req.mode === "navigate") return caches.match("./index.html");
        throw new Error("Offline and not cached");
      }
    })()
  );
});

// This is what your in-app "Refresh" button triggers:
// reg.waiting.postMessage({type:"SKIP_WAITING"})
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting(); // activates the waiting SW now [page:1]
  }
});
