/**
 * MyDukaan24 — Service Worker v6.0
 * Created & Deployed by Mayur Singh
 * High-Speed Offline-Ready PWA & Network-First Caching Engine
 */

const CACHE_NAME = 'mydukkan24-v6.0';

const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './assets/LOGO.jpeg',
  './assets/logo.svg',
  './assets/MyDukkan24-v4.apk',
  './css/style.css?v=6.0',
  './css/components.css?v=6.0',
  './css/landing.css?v=6.0',
  './js/icons.js?v=6.0',
  './js/i18n.js?v=6.0',
  './js/storage.js?v=6.0',
  './js/scanner.js?v=6.0',
  './js/pos.js?v=6.0',
  './js/inventory.js?v=6.0',
  './js/purchases.js?v=6.0',
  './js/khata.js?v=6.0',
  './js/analytics.js?v=6.0',
  './js/staff.js?v=6.0',
  './js/ai.js?v=6.0',
  './js/app.js?v=6.0'
];

// Install: Cache core assets and activate immediately
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW v6.0] Precaching assets');
      return cache.addAll(ASSETS_TO_PRECACHE).catch(err => {
        console.warn('[SW] Precache non-blocking error:', err);
      });
    })
  );
});

// Activate: Immediately purge all older caches and take control
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW v6.0] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: NETWORK-FIRST strategy for documents, CSS, and JS so user always gets the freshest deployed code!
self.addEventListener('fetch', (e) => {
  // Never intercept external APIs, Netlify serverless endpoints, or browser extensions
  if (e.request.url.includes('googleapis.com') || 
      e.request.url.includes('/api/') || 
      e.request.url.includes('openfoodfacts.org') ||
      e.request.url.includes('qrserver.com') ||
      e.request.url.startsWith('chrome-extension') ||
      e.request.method !== 'GET') {
    return;
  }

  // Network-First with Offline Cache Fallback
  e.respondWith(
    fetch(e.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return networkRes;
      })
      .catch(() => {
        // Network failed (offline), serve from cache
        return caches.match(e.request).then((cached) => {
          if (cached) return cached;
          if (e.request.destination === 'document') {
            return caches.match('./app.html') || caches.match('./index.html');
          }
        });
      })
  );
});
