const CACHE_NAME = 'surge-v2';
const ASSETS = [
    './',
    './index.html',
    './before.html',
    './during.html',
    './after.html',
    './detect.html',
    './style.css',
    './radar-style.css',
    './beacon-style.css',
    './claim-style.css',
    './vault-style.css',
    './highground-style.css',
    './script.js',
    './radar-script.js',
    './beacon.js',
    './claim.js',
    './vault.js',
    './highground.js',
    './assets/logo.png',
    'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&family=Courier+Prime:wght@400;700&display=swap'
];

// Install: Cache all essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// Fetch: Serve from cache if offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
