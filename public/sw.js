// Keeps StudReads working offline after the first visit. Built files under /assets/ are
// named by their content, so they are served from the cache; everything else is fetched
// fresh and the cached copy is only used when there is no connection.
const CACHE = 'studreads-v1';
const SHELL = ['/', '/brand-mark.png', '/favicon.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

const store = (key, response) => {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(key, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => store(request, response))));
    return;
  }

  // Pages are stored without their query, so a shared link still opens offline.
  const key = request.mode === 'navigate' ? url.pathname : request;
  event.respondWith(fetch(request)
    .then((response) => store(key, response))
    .catch(() => caches.match(key).then((cached) => cached || caches.match('/'))));
});
