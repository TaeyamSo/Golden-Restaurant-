// Golden service worker: offline menu after the first visit, light on data.
// Bump VERSION when you upload changed files so returning visitors get them.
const VERSION = 'golden-v11';
const SHELL_CACHE = `${VERSION}-shell`;
const IMG_CACHE = `${VERSION}-img`;
const IMG_LIMIT = 80;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './data/menu.json',
  './assets/css/fonts.css',
  './assets/css/main.css',
  './assets/js/app.js',
  './assets/js/data.js',
  './assets/js/format.js',
  './assets/js/cart.js',
  './assets/js/order.js',
  './assets/js/menu.js',
  './assets/js/reels.js',
  './assets/js/sheet.js',
  './assets/js/pwa.js',
  './assets/fonts/ibm-plex-sans-arabic-400-arabic.woff2',
  './assets/fonts/ibm-plex-sans-arabic-400-latin.woff2',
  './assets/fonts/ibm-plex-sans-arabic-600-arabic.woff2',
  './assets/fonts/ibm-plex-sans-arabic-600-latin.woff2',
  './assets/fonts/reem-kufi-500-700-arabic.woff2',
  './assets/fonts/reem-kufi-500-700-latin.woff2',
  './assets/icons/icon-192.png',
  './assets/img/hero-p-720.webp',
  './assets/img/hero-p-1080.webp',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // videos stream with Range requests; let the browser handle them directly
  if (req.headers.has('range') || url.pathname.endsWith('.mp4')) return;

  if (req.mode === 'navigate') e.respondWith(networkFirst(req, SHELL_CACHE, './index.html'));
  else if (url.pathname.endsWith('/menu.json')) e.respondWith(networkFirst(req, SHELL_CACHE));
  else if (/\.(webp|png|jpe?g|svg)$/.test(url.pathname)) e.respondWith(cacheFirst(req));
  else e.respondWith(staleWhileRevalidate(req));
});

/** Network with a timeout (slow connections), falling back to the cached copy. */
async function networkFirst(req, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (fallbackUrl) {
      const shell = await cache.match(fallbackUrl);
      if (shell) return shell;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req);
  const update = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || update;
}

async function cacheFirst(req) {
  const cache = await caches.open(IMG_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) {
      await cache.put(req, res.clone());
      trim(cache);
    }
    return res;
  } catch {
    return (await caches.match(req)) || Response.error();
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - IMG_LIMIT; i++) await cache.delete(keys[i]);
}
