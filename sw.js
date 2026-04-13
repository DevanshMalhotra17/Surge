const CACHE_NAME = 'surge-v1';
const ASSETS = [
    'index.html',
    'before.html',
    'during.html',
    'after.html',
    'detect.html',
    'radar.html',
    'highground.html',
    'vault.html',
    'beacon.html',
    'claim.html',
    'style.css',
    'radar-style.css',
    'vault-style.css',
    'beacon-style.css',
    'claim-style.css',
    'script.js',
    'radar-script.js',
    'highground.js',
    'vault.js',
    'beacon.js',
    'claim.js',
    'assets/logo.png',
    'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,700;1,300&family=Courier+Prime:wght@400;700&display=swap'
];

// Install Event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// Fetch Event (Offline first)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
