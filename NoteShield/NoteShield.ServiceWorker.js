const cacheName = 'NoteShieldV1'; // Not pushing the updates but the user may actively fetch the update.

const appFiles = [
  "/NoteShield/NoteShield.html",
  "/NoteShield/NoteShield.64x64.png",
];


self.addEventListener('install', function(event) {
  event.waitUntil(self.caches.open(cacheName).then(function(cache) {
    return cache.addAll(appFiles);
  }));
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(request) {
      if (request) {
        return request;
      }
      // else: cache miss
      return fetch(event.request).then(function(response) {
        return caches.open(cacheName).then(function(cache) {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
});
