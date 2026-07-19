const CACHE_NAME = "fionn-engine-1.0-clontarf";
const APP_SHELL = [
  "./", "./index.html", "./tour.config.js", "./config/stops.json", "./manifest.webmanifest",
  "../../engine/css/styles.css", "../../engine/js/app.js", "../../engine/js/utils.js",
  "../../engine/js/dev-tools.js", "../../engine/js/services/assets.js", "../../engine/js/services/gps.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.hostname.endsWith("r2.dev") || event.request.headers.has("range")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok && url.origin === self.location.origin) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request)));
});
