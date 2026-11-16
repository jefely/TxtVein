/* TxtVein PWA shell. Keep the single-file app available offline. */
const CACHE = 'txtvein-shell-v2.2.3';
const SHELL = [
  './TxtVein.html',
  './manifest.webmanifest',
  './assets/icons/txtvein-ve-192.png',
  './assets/icons/txtvein-ve-512.png',
  './assets/icons/apple-touch-icon-ve.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(event.request).then((hit) => (
      hit || (event.request.mode === 'navigate' ? caches.match('./TxtVein.html') : undefined)
    )))
  );
});
