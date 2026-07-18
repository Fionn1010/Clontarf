const CACHE_NAME = "fionn-clontarf-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./config/stops.json",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Range requests are required for reliable MP4 playback on mobile.
  if (request.headers.has("range")) {
    event.respondWith(handleRangeRequest(request));
    return;
  }

  // Navigation: network first, then cached index.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Same-origin assets: cache first, update in background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
  }
});

async function handleRangeRequest(request) {
  const rangeHeader = request.headers.get("range");
  const cached = await caches.match(request.url);
  let response = cached;

  if (!response) {
    response = await fetch(request.url);
    if (response.ok && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request.url, response.clone());
    }
  }

  if (!response || !response.ok) return response;

  const data = await response.arrayBuffer();
  const size = data.byteLength;
  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);

  if (!match) return response;

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  const chunk = data.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunk.byteLength),
      "Content-Type": response.headers.get("Content-Type") || "video/mp4"
    }
  });
}
