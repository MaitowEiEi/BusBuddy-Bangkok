// Bump this when the caching logic changes; old caches are deleted on activate.
const VERSION = 'v1';
const CACHE = `busbuddy-${VERSION}`;
const SCOPE = new URL(self.registration.scope);
const inScope = (url) => url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);

// Cache the app page and the JS/CSS files it links to, so the next visit works offline.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch(SCOPE.href, { cache: 'no-store' });
    if (res.ok) {
      await cache.put(SCOPE.href, res.clone());
      const html = await res.text();
      const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => new URL(m[1], SCOPE.href))
        .filter(inScope)
        .map((u) => u.href);
      await Promise.allSettled([...new Set(urls)].map((u) => cache.add(u)));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('busbuddy-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!inScope(url)) return; // map tiles and other sites go straight to the network

  // Pages: try the network first so updates show up, fall back to the cached copy offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(SCOPE.href, res.clone());
        return res;
      } catch {
        return (await caches.match(SCOPE.href)) || Response.error();
      }
    })());
    return;
  }

  // Built files have a hash in their name and never change, so the cached copy is always right.
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});