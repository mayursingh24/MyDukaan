/**
 * MyDukaan24 — Service Worker v7.1
 * Created & Deployed by Mayur Singh (Lucknow, India)
 * High-Speed Offline-Ready PWA & Pure Network-First Caching Engine
 */

const CACHE_NAME = 'mydukkan24-v7.1';

const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './assets/LOGO.jpeg',
  './assets/logo.svg',
  './assets/MyDukkan24-v4.apk',
  './css/style.css?v=7.1',
  './css/components.css?v=7.1',
  './css/landing.css?v=7.1',
  './js/html5-qrcode.min.js?v=7.1',
  './js/icons.js?v=7.1',
  './js/i18n.js?v=7.1',
  './js/storage.js?v=7.1',
  './js/scanner.js?v=7.1',
  './js/pos.js?v=7.1',
  './js/inventory.js?v=7.1',
  './js/purchases.js?v=7.1',
  './js/khata.js?v=7.1',
  './js/analytics.js?v=7.1',
  './js/staff.js?v=7.1',
  './js/ai.js?v=7.1',
  './js/app.js?v=7.1'
];

// Install: Cache core assets and activate immediately
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW v7.1] Precaching assets');
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
            console.log('[SW v7.1] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Pure Network-First Fetch Strategy: Always attempt fresh network fetch first
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Never cache Netlify serverless functions or external APIs
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./app.html');
          }
        });
      })
  );
});
