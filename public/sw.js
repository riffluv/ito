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

const updateBroadcast =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("ito-safe-update-v1") : null;

const notifyUpdateChannels = async (eventType) => {
  try {
    updateBroadcast?.postMessage({
      type: eventType,
      source: "service-worker",
      version: SW_VERSION,
      timestamp: Date.now(),
    });
  } catch {
    /* ignore broadcast channel failure */
  }
  if (!self.clients?.matchAll) {
    return;
  }
  try {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: "window",
    });
    const payload = {
      type: "SAFE_UPDATE_SYNC",
      event: eventType,
      version: SW_VERSION,
      timestamp: Date.now(),
    };
    for (const client of clients) {
      client.postMessage(payload);
    }
  } catch {
    /* ignore client broadcast failure */
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
      if (self.registration?.active) {
        await notifyUpdateChannels("update-ready");
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  const { type } = event.data;
  if (type === "SKIP_WAITING") {
    event.waitUntil(
      (async () => {
        try {
          await notifyUpdateChannels("update-applying");
        } finally {
          await self.skipWaiting();
        }
      })()
    );
  }
  if (type === "CLIENTS_CLAIM") {
    event.waitUntil(
      (async () => {
        try {
          await self.clients.claim();
        } finally {
          await notifyUpdateChannels("clients-claim");
        }
      })()
    );
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim().catch(() => undefined);
      await notifyUpdateChannels("update-applied");
    })()
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

