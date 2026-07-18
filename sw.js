
const CACHE_NAME = "clontarf-tour-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./tour.html",
  "./stop.html",
  "./ar.html",
  "./styles.css",
  "./app.js",
  "./stop.js",
  "./ar.js",
  "./stops.json",
  "./manifest.webmanifest",
  "./assets/images/hero.jpg",
  "./assets/images/scene-1.jpg",
  "./assets/images/scene-2.jpg",
  "./assets/images/scene-3.jpg",
  "./assets/images/scene-4.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type !== "error") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      // Pages: network first, then cache. Images/assets: cache first.
      if (event.request.mode === "navigate") {
        return networkFetch || cached || caches.match("./index.html");
      }
      return cached || networkFetch;
    })
  );
});
