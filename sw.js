const VERSION = "fionn-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./config/platform.json",
  "./engine/fionn-platform.js",
  "./engine/bootstrap.js",
  "./css/fionn-platform.css"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isCode = /\.(?:html?|css|js|json)$/i.test(url.pathname);
  const isLargeMedia = /\.(?:glb|gltf|mp4|webm|mp3|m4a|wav|ogg|png|jpe?g|webp)$/i.test(url.pathname);

  if (isNavigation || isCode) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  if (isLargeMedia) {
    event.respondWith(
      caches.match(request).then(hit => {
        if (hit) return hit;
        return fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then(cache => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
