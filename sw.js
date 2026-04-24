const CACHE_NAME = 'kombucha-twin-v4';
const CACHE_VERSION = '1.0.0';
const CACHE_KEY = `${CACHE_NAME}-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    '/index.html',
    '/engine.js',
    '/app.js',
    '/manifest.json'
];

const CDN_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_KEY).then((cache) => {
            return cache.addAll([...STATIC_ASSETS, ...CDN_ASSETS]);
        }).then(() => {
            self.skipWaiting();
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => {
                    return name.startsWith(CACHE_NAME) && name !== CACHE_KEY;
                }).map((name) => {
                    return caches.delete(name);
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    
    if (request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_KEY).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                if (request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                return null;
            });
        })
    );
});