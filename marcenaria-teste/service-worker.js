const CACHE = "oficina-shell-v13-funcionarios-batch";
const FILES = ["./", "./index.html", "./styles.css", "./app.js?v=20261008-funcionarios2", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", event => event.waitUntil((async () => { const cache = await caches.open(CACHE); await cache.addAll(FILES); await self.skipWaiting(); })()));
self.addEventListener("activate", event => event.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))); await self.clients.claim(); })()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin === location.origin && (url.pathname.endsWith("/app.js") || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/"))) {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match("./index.html"))));
});
