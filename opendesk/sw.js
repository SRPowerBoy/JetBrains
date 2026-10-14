// Offline support. Precaches the whole app, then serves from cache and refreshes in the
// background (stale-while-revalidate), so updates appear on the next visit.
// Bump VERSION when files are added or removed.
const VERSION = 'opendesk-v2';
const FILES = [
  './', 'index.html', 'writer.html', 'sheets.html', 'slides.html',
  'common.css', 'common.js', 'features.js', 'sheets-engine.js', 'sheets-fill.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/mammoth.browser.min.js', 'vendor/xlsx.full.min.js', 'vendor/pptxgen.bundle.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    // ignoreSearch: writer.html?id=… is the same file as writer.html.
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(res => {
      if (res.ok) cache.put(req.url.split('?')[0], res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
