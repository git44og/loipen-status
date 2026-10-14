const SHELL = 'shell-v1', TILES = 'tiles-v1', DATA = 'data-v1';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/layers.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![SHELL, TILES, DATA].includes(k)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req, name) {
  try { const r = await fetch(req); if (r.ok) (await caches.open(name)).put(req, r.clone()); return r; }
  catch { const hit = await caches.match(req); if (hit) return hit; throw new Error('offline'); }
}
async function cacheFirst(req, name) {
  const hit = await caches.match(req); if (hit) return hit;
  const r = await fetch(req); if (r.ok) (await caches.open(name)).put(req, r.clone()); return r;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.endsWith('/data/loipen.geojson')) e.respondWith(networkFirst(e.request, DATA)); // Status immer frisch, offline letzter Stand
  else if (url.hostname.endsWith('tile.openstreetmap.org')) e.respondWith(cacheFirst(e.request, TILES));
  else if (url.origin === location.origin) e.respondWith(caches.match(e.request).then((h) => h || fetch(e.request)));
});
