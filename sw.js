// Network-first for the page, cache-first for static assets.
//
// The page MUST be network-first: this app's whole value is its venue data,
// and a cache-first page serves yesterday's data on every load, so a deploy
// only shows up on the second or third open. Network-first means the newest
// index.html wins whenever the phone is online, and the cache is only the
// offline fallback.
//
// Bump CACHE whenever a cached file changes.
const CACHE = 'perth-eats-v3626-2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPage(req) {
  return req.mode === 'navigate' ||
         req.destination === 'document' ||
         (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  if (!sameOrigin) return;

  // The page: network first, cache only as the offline fallback.
  if (isPage(e.request)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Everything else (icons, manifest): cache first, it rarely changes.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
