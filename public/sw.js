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

// Precaches are intentionally minimal and limited to stable, un-hashed assets.
// Next.js 14 App Router no longer emits /_next/static/chunks/main.js or webpack.js,
// and precaching unknown hashed assets causes install to reject when a 404 occurs.
// Keep this list small to guarantee install never fails while still providing
// an offline shell.
const CORE_ASSETS = ["/", "/manifest.webmanifest", "/images/knight1.webp"];

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

const reportFetchError = async (detail) => {
  if (!self.clients?.matchAll) {
    return;
  }
  try {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: "window",
    });
    const payload = {
      type: "SAFE_UPDATE_FETCH_ERROR",
      detail: {
        url: detail.url,
        status: typeof detail.status === "number" ? detail.status : null,
        method: detail.method ?? null,
        scope: detail.scope ?? null,
        version: SW_VERSION,
        error: detail.error ?? null,
      },
    };
    for (const client of clients) {
      client.postMessage(payload);
    }
  } catch {
    /* ignore client report failure */
  }
};

const precacheCoreAssets = async () => {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(
    CORE_ASSETS.map((path) =>
      cache.add(path).catch((error) => {
        // Surface but do not fail install; missing assets should not block SW activation.
        void reportFetchError({
          url: path,
          status: null,
          method: "GET",
          scope: "precache",
          error: error?.message ?? "precache",
        });
        return null;
      })
    )
  );
  // If every entry failed, still resolve to avoid install rejection.
  const anyFulfilled = results.some((r) => r.status === "fulfilled");
  if (!anyFulfilled) {
    // Create a minimal offline shell so activation can proceed.
    try {
      await cache.put("/", new Response("", { status: 200 }));
    } catch {
      /* ignore */
    }
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await precacheCoreAssets();

        // Best-effort precache for hashed assets using Next manifest (may not exist in App Router).
        try {
          const manifest = await fetch("/_next/static/manifest.json").then((res) =>
            res.ok ? res.json() : null
          );
          if (manifest && manifest.pages) {
            const pageAssets = Object.values(manifest.pages)
              .flat()
              .filter((v) => typeof v === "string");
            const unique = Array.from(new Set(pageAssets));
            await Promise.all(
              unique.map((path) =>
                caches.open(CACHE_NAME).then((cache) =>
                  cache.add(path).catch(() => {
                    /* ignore */
                  })
                )
              )
            );
          }
        } catch {
          /* ignore precache failure */
        }
      } finally {
        // Even if precache partially fails, allow the SW to install so waiting/activate can proceed.
        if (self.registration?.active) {
          await notifyUpdateChannels("update-ready");
        }
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
      (async () => {
        let reported = false;
        try {
          const response = await fetch(request);
          if (!response.ok) {
            reported = true;
            await reportFetchError({
              url: request.url,
              status: response.status,
              method: request.method,
              scope: "navigation",
              error: `response_${response.status}`,
            });
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        } catch (error) {
          if (!reported) {
            await reportFetchError({
              url: request.url,
              status: null,
              method: request.method,
              scope: "navigation",
              error: error?.message ?? "network",
            });
          }
          const cache = await caches.open(CACHE_NAME);
          const shell =
            (await cache.match(request)) ||
            (await cache.match("/")) ||
            (await cache.match("/_next/static/chunks/main.js"));
          if (shell) return shell;
          return new Response("", { status: 503, statusText: "offline" });
        }
      })()
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

