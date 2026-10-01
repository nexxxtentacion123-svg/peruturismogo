const CACHE_NAME = 'peruturismo-shell-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './lugares.json',
  './lugares-extra.json',
  './lugares-lima.json',
  './rutas.json',
  './js/main.js',
  './js/state.js',
  './js/ui.js',
  './js/map.js',
  './js/filters.js',
  './js/geo.js',
  './js/auth.js',
  './js/recommendations.js',
  './js/gamification.js',
  './js/supabase-config.js',
  './js/utils/geoUtils.js',
  './js/utils/sanitize.js',
  './assets/favicon.png',
  './assets/favicon-64.png',
  './assets/kuntur-avatar.png',
  './assets/kuntur-mascot-transparent.png'
];
const PUBLIC_MODULES = ['https://esm.sh/@supabase/supabase-js@2'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(
    [...SHELL, ...PUBLIC_MODULES].map(asset => cache.add(asset).catch(error => {
      console.warn('PWA: no se pudo precargar', asset, error);
    }))
  )));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept Supabase, auth, map tiles, CDN, or non-GET/private requests.
  const isPublicModule = url.origin === 'https://esm.sh';
  if (request.method !== 'GET' || (!isPublicModule && url.origin !== self.location.origin) ||
      url.pathname.includes('/rest/') || url.pathname.includes('/auth/')) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
