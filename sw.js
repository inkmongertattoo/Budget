// SplitBudget Service Worker
// Version du cache — incrémente pour forcer la mise à jour
var CACHE_NAME = 'splitbudget-v2';

// Fichiers à mettre en cache pour le mode hors-ligne
var ASSETS = [
  './budget-app.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap'
];

// Installation — mise en cache des assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Mise en cache des fichiers');
      // On essaie de cacher chaque fichier individuellement pour éviter
      // qu'une erreur sur un seul fichier bloque tout
      return Promise.allSettled(
        ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Impossible de cacher:', url, err);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activation — nettoyage des anciens caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          console.log('[SW] Suppression ancien cache:', name);
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch — stratégie Cache First avec fallback réseau
self.addEventListener('fetch', function(event) {
  // Ignorer les requêtes non-GET et les extensions Chrome
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('chrome-extension')) return;

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        // Fichier trouvé en cache — on le sert et on met à jour en arrière-plan
        var fetchPromise = fetch(event.request).then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            var responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(function() {
          // Silencieux en arrière-plan
        });
        return cachedResponse;
      }

      // Pas en cache — on va chercher sur le réseau
      return fetch(event.request).then(function(networkResponse) {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        var responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      }).catch(function() {
        // Hors-ligne et pas en cache — retourner la page principale
        return caches.match('./budget-app.html');
      });
    })
  );
});
