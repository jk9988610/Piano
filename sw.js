/**
 * Piano Studio — offline cache for static assets & samples.
 * Bump CACHE_VERSION with each release (matches VERSION file).
 */
const CACHE_VERSION = "0.4.13";
const CACHE_NAME = `piano-studio-${CACHE_VERSION}`;

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isShellAsset(pathname) {
  return (
    pathname.endsWith("/") ||
    pathname.endsWith("/index.html") ||
    pathname.endsWith("/version.json") ||
    pathname.endsWith("/sw.js")
  );
}

function isCacheableAsset(pathname) {
  return (
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".mp3") ||
    pathname.endsWith(".json") ||
    isShellAsset(pathname)
  );
}

function isSampleAsset(pathname) {
  return pathname.endsWith(".mp3");
}

function isCodeAsset(pathname) {
  return pathname.endsWith(".js") || pathname.endsWith(".css") || pathname.endsWith(".json");
}

async function networkFirst(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url) || !isCacheableAsset(url.pathname)) return;

  if (isShellAsset(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      if (isSampleAsset(url.pathname)) return cacheFirst(request, cache);
      if (isCodeAsset(url.pathname)) return networkFirst(request, cache);
      return networkFirst(request, cache);
    })
  );
});
