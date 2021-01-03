"use strict";

function resolvablePromise() {
  let resolve = undefined;
  let reject = undefined;
  this.promise = new Promise(function(resolutionFunc, rejectionFunc){
    resolve = resolutionFunc;
    reject = rejectionFunc;
  });
  this.resolve = resolve;
  this.reject = reject;
}

const jsonCacheName = "NoteShieldJson";
const jsonFile = "/NoteShield/NoteShield.json";

const jsonFetchPeriodInMilliSec = 60000; // 1 minute
let lastJsonFetch = null;
let jsonPromise = null;
function getJsonAsync() {
  const now = new Date();
  if (!lastJsonFetch || now.valueOf() - lastJsonFetch.valueOf() > jsonFetchPeriodInMilliSec) {
    jsonPromise = null;
  }
  if (!jsonPromise) {
    jsonPromise = new resolvablePromise();
    (async function(){
      // First try online.
      try {
        const jsonResponse = await self.fetch(jsonFile);
        const responseClone = jsonResponse.clone();
        const json = await jsonResponse.json();
        const jsonCache = await self.caches.open(jsonCacheName);
        await jsonCache.put(jsonFile, responseClone);
        jsonPromise.resolve(json);
        lastJsonFetch = now;
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
  return jsonPromise.promise;
}

async function getCacheNameAsync() {
  const json = await getJsonAsync();
  return `NoteShieldV${json.version}`;
}

async function purgeObsoleteCaches() {
  const currentCacheName = await getCacheNameAsync();
  const cachedNames = await self.caches.keys();
  const obsoluteCachedNames = cachedNames.filter((cacheName) => (cacheName !== jsonCacheName && cacheName !== currentCacheName));
  if (obsoluteCachedNames.length > 0) {
    await Promise.all(obsoluteCachedNames.map((cacheName) => (self.caches.delete(cacheName))));
  }
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

self.addEventListener("activate", function(event){
  event.waitUntil(purgeObsoleteCaches());
});

self.addEventListener("fetch", function(event) {
  if (event.request.url === jsonFile) {
    event.respondWith(getJsonAsync());
  } else {
    event.respondWith((async function(){
      // First clear obsolete caches.
      await purgeObsoleteCaches();

      // Then try the still valid caches.
      const cachedResponse = await self.caches.match(event.request, { ignoreSearch: true });
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
