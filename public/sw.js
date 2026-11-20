// @ts-nocheck
const MEDIA_CACHE_NAME = 'uda-uni-media-cache-v2';
const CACHEABLE_PREFIXES = [
  '/assets/uda-uni-2024/',
  '/assets/uda-uni-2022/',
  '/assets/placeholders/',
  '/assets/aistudio/',
  '/src/assets/images/',
];

function isCacheableMedia(url) {
  if (url.origin !== self.location.origin) return false;
  return CACHEABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('uda-uni-media-cache-') && key !== MEDIA_CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const {request} = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isCacheableMedia(url)) return;

  event.respondWith(
    caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }),
  );
});
