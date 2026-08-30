// v2: network-first for the app shell (index.html) so installed PWAs always
// get the latest version when online — the old v1 strategy was cache-first,
// which meant an installed app could get permanently "stuck" on whatever
// version was cached the very first time it was installed.
const CACHE_NAME = 'mr-mahmood-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isNavigation = event.request.mode === 'navigate';
  const isAppShell = isNavigation || CORE_ASSETS.some((a) => event.request.url.endsWith(a.replace('./', '/')));

  if (isAppShell) {
    // Network-first: always try to get the latest index.html/app shell when
    // online. Only fall back to the cached copy if the network request
    // fails (offline), so the app still works without internet.
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (fonts, Chart.js from CDN, etc.): cache-first, since
  // these rarely change and this keeps the app fast and usable offline.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
