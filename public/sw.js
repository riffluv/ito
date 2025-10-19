const SCRIPT_URL = typeof self !== "undefined" ? (self.registration?.scriptURL || self.location?.href || "") : "";
const SW_VERSION = (() => {
  try {
    const url = new URL(SCRIPT_URL);
    return url.searchParams.get("v") || "default";
  } catch (error) {
    return "default";
  }
})();
const CACHE_PREFIX = "ito-app-cache";
const CACHE_NAME = `${CACHE_PREFIX}-${SW_VERSION}`;
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/images/knight1.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  const { type } = event.data;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (type === "CLIENTS_CLAIM") {
    self.clients.claim().catch(() => undefined);
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

const isNavigationRequest = (request) => request.mode === "navigate";
const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || !isSameOrigin(request)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((match) => match || caches.match("/")))
    );
    return;
  }

  if (request.url.includes("/_next/image")) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

