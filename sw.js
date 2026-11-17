// Service worker : app disponible hors-ligne (mode avion compris).
const VERSION = 'appfamille-v0.1.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/store.js', './js/ui.js', './js/icons.js', './js/profiles.js', './js/audio.js', './js/sync.js',
  './js/pages/home.js', './js/pages/edit.js', './js/pages/stats.js', './js/pages/plan.js', './js/miniplayer.js', './js/milk.js', './js/pages/agenda.js', './js/supplies.js', './js/data/templates.js', './js/pages/growth.js', './js/pages/food.js', './js/pages/parents.js', './js/pages/sleep.js', './js/modules.js', './js/pages/hub.js',
  './js/data/foods.js', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Polices Google : cache puis réseau en arrière-plan.
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(request);
      const net = fetch(request).then((r) => { cache.put(request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin || url.pathname.endsWith('.php')) return;

  // App : réseau d'abord (mises à jour), cache en secours.
  e.respondWith(
    fetch(request)
      .then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); return r; })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')))
  );
});
