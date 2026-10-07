// Service worker: caches the app shell so the app works offline.
const VERSION = 'v9';
const CACHE = `invoices-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/nav.js',
  './js/ui.js',
  './js/db.js',
  './js/store.js',
  './js/dec.js',
  './js/models.js',
  './js/format.js',
  './js/numbering.js',
  './js/totals.js',
  './js/demo.js',
  './js/docquery.js',
  './js/docs.js',
  './js/share.js',
  './js/exports.js',
  './js/xlsx.js',
  './js/zip.js',
  './js/views/home.js',
  './js/views/doclist.js',
  './js/views/contacts.js',
  './js/views/menu.js',
  './js/views/businesses.js',
  './js/views/clients.js',
  './js/views/editor.js',
  './js/views/itemEditor.js',
  './js/views/pickers.js',
  './js/views/preview.js',
  './js/views/settings.js',
  './js/views/items.js',
  './js/backup.js',
  './js/pdf/index.js',
  './js/pdf/layout.js',
  './js/pdf/painters.js',
  './vendor/jspdf.umd.min.js',
  './vendor/OpenSans-Regular.ttf',
  './vendor/OpenSans-Bold.ttf',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res && res.ok && new URL(event.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
