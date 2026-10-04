/**
 * MyDukaan Pro — Service Worker
 * Created & Deployed by Mayur Singh
 * Offline-First Caching for Indian Retailers
 */

const CACHE_NAME = 'mydukaan-pro-v4-cache';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './css/style.css',
  './css/components.css',
  './css/landing.css',
  './js/storage.js',
  './js/scanner.js',
  './js/pos.js',
  './js/inventory.js',
  './js/khata.js',
  './js/analytics.js',
  './js/staff.js',
  './js/ai.js',
  './js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching MyDukaan Pro assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Never intercept Gemini API calls or chrome-extensions
  if (e.request.url.includes('googleapis.com') || e.request.url.startsWith('chrome-extension')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200 && e.request.method === 'GET') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return networkRes;
      }).catch(() => {
        // Fallback to app.html or index.html when offline
        if (e.request.destination === 'document') {
          return caches.match('./app.html') || caches.match('./index.html');
        }
      });
    })
  );
});
