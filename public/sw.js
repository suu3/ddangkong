const VERSION = 'ddangkong-v2';
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = ['/', '/manifest.json', OFFLINE_URL, '/logos/icon-192x192.png', '/logos/icon-512x512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => ![SHELL_CACHE, RUNTIME_CACHE, STATIC_CACHE].includes(key))
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  if (url.pathname === '/manifest.json') {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
  }
});

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    const offlineResponse = await caches.match(OFFLINE_URL);
    if (offlineResponse) return offlineResponse;

    return Response.error();
  }
}

async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async response => {
      if (response.ok) {
        const responseForCache = response.clone();
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, responseForCache);
      }
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    return Response.error();
  }
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/logos/') ||
    pathname.startsWith('/button/') ||
    pathname.startsWith('/coffee/') ||
    pathname.startsWith('/roulette/') ||
    pathname.startsWith('/sound/') ||
    pathname.startsWith('/split-team/') ||
    pathname.startsWith('/hot-potato/') ||
    pathname === '/favicon.ico'
  );
}
