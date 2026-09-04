/**
 * Symmetry Healthcare Platform - Service Worker
 * Version: sih-static-shell-v1
 * 
 * Handles caching and serving of the STATIC APPLICATION SHELL.
 * Sensitive healthcare API requests and auth tokens are NOT cached here.
 * Dynamic healthcare data is handled via IndexedDB (offline-db.js).
 */

const CACHE_NAME = 'sih-static-shell-v1';

const STATIC_SHELL_ASSETS = [
    './',
    './index.html',
    './signup.html',
    './otp.html',
    './dashboard.html',
    './appointments.html',
    './queue.html',
    './specialists.html',
    './diagnostics.html',
    './medicines.html',
    './facilities.html',
    './referrals.html',
    './profile.html',
    './notifications.html',
    './crowd.html',
    './crowd-forecast.html',
    './css/style.css',
    './js/api.js',
    './js/auth.js',
    './js/offline-db.js',
    './js/connectivity.js',
    './js/sync-manager.js',
    './js/dashboard.js',
    './js/appointments.js',
    './js/facilities.js',
    './js/specialists.js',
    './js/diagnostics.js',
    './js/medicines.js',
    './js/referrals.js',
    './js/profile.js',
    './js/queue.js',
    './js/notifications.js',
    './manifest.json'
];

// Install Event: Cache Static App Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Pre-caching static shell assets...');
            return cache.addAll(STATIC_SHELL_ASSETS).catch((err) => {
                console.warn('[ServiceWorker] Pre-cache partial warning:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate Event: Clean up outdated shell caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[ServiceWorker] Removing old shell cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Shell Network-First with Cache-Fallback (Navigation) / Cache-First for static assets
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // SECURITY RULE: Never intercept or store backend dynamic API responses or Auth requests in Service Worker Cache
    if (
        url.port === '8000' ||
        url.pathname.startsWith('/auth') ||
        url.pathname.startsWith('/appointments') ||
        url.pathname.startsWith('/facilities') ||
        url.pathname.startsWith('/specialists') ||
        url.pathname.startsWith('/diagnostics') ||
        url.pathname.startsWith('/medicines') ||
        url.pathname.startsWith('/referrals') ||
        url.pathname.startsWith('/operational-state') ||
        url.pathname.startsWith('/routing') ||
        url.pathname.startsWith('/crowd') ||
        url.pathname.startsWith('/emergency') ||
        url.pathname.startsWith('/health')
    ) {
        // Pass directly to network
        return;
    }

    // Handle HTML Navigation requests (Network-First, Fallback to Cache)
    if (request.mode === 'navigate' || request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    console.log('[ServiceWorker] Navigation network failed, using cached shell for:', url.pathname);
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // Fallback to dashboard, then index if neither is cached
                    const dashboard = await caches.match('./dashboard.html');
                    if (dashboard) {
                        return dashboard;
                    }

                    const index = await caches.match('./index.html');
                    if (index) {
                        return index;
                    }

                    return new Response('Application shell unavailable offline', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                })
        );
        return;
    }

    // Handle Static Assets (CSS, JS, Fonts, Images)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Fetch in background to update cache (Stale-While-Revalidate)
                fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, networkResponse);
                        });
                    }
                }).catch(() => {/* Ignore background network fetch failure */ });
                return cachedResponse;
            }

            // Not in cache, fetch from network
            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok && request.method === 'GET') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch((err) => {
                console.warn('[ServiceWorker] Failed to fetch static resource:', request.url, err);
                // Return empty/fallback if needed
                return new Response('Resource unavailable offline', { status: 503, statusText: 'Service Unavailable' });
            });
        })
    );
});
