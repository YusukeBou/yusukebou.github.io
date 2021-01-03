function resolvablePromise() {
  this.resolve = undefined;
  this.reject = undefined;
  this.promise = new Promise(function(resolutionFunc, rejectionFunc){
    this.resolve = resolutionFunc;
    this.reject = rejectionFunc;
  });
}

const jsonCacheName = "NoteShieldJson";
const jsonFile = "/NoteShield/NoteShield.json";

let jsonPromise = null;
function getJsonAsync() {
  if (!jsonPromise) {
    jsonPromise = new resolvablePromise();
    (async function(){
      // First try online.
      try {
        const jsonResponse = await self.fetch(jsonFile);
        const json = await jsonResponse.json();
        const jsonCache = await self.caches.open(jsonCacheName);
        await cache.put(jsonFile, jsonResponse.clone());
        jsonPromise.resolve(json);
      } catch (errorOnline) {
        // Next try cache.
        try {
          cachedResponse = await self.caches.match(jsonFile);
          const json = await cachedResponse.json();
          jsonPromise.resolve(json);
        } catch (errorCache) {
          throw errorOnline; // Cache mishit is not an error.
        }
      }
    })();
  }
  return jsonPromise;
}

async function getCacheNameAsync() {
  const json = await getJsonAsync();
  return `NoteShieldV${json.version}`;
}

const appFiles = [
  "/NoteShield/NoteShield.html",
  "/NoteShield/NoteShield.64x64.png",
  "/NoteShield/NoteShield.120x120.png",
  "/NoteShield/NoteShield.180x180.png",
];

self.addEventListener("install", function(event) {
  event.waitUntil((async function(){
    const jsonCache = await self.caches.open(jsonCacheName);
    await jsonCache.add(jsonFile);
    const cacheName = await getCacheNameAsync();
    const cache = await self.caches.open(cacheName);
    await cache.addAll(appFiles);
  })());
});

self.addEventListener("fetch", function(event) {
  if (event.request.url === jsonFile) {
    event.respondWith(getJsonAsync());
  } else {
    event.respondWith((async function(){
      // First try cache.
      const cachedResponse = await self.caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      // else: try online.
      const response = await self.fetch(event.request);
      const cacheName = await getCacheNameAsync();
      const cache = await caches.open(cacheName);
      await cache.put(event.request, response.clone());
      return response;
    })());
  }
});
