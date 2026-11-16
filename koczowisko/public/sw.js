/* Only an anonymous, static offline page is cached. NEVER cache account/API/audio responses. */
const CACHE = "kocz-browser-static-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/offline.html", "/icon.svg"])));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("kocz-browser-") && key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET" || event.request.mode !== "navigate" || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match("/offline.html")) || new Response("Brak połączenia. Spróbuj ponownie.", { status: 503 })));
});
