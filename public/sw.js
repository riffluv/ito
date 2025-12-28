const SCRIPT_URL = typeof self !== "undefined" ? (self.registration?.scriptURL || self.location?.href || "") : "";

// Pull a per-deploy build tag from a tiny dynamic script so update checks
// detect new builds even when the page stays on an old version. The script
// body changes on every deployment (see app/sw-meta.js/route.ts), which makes
// the Service Worker update algorithm treat it as a new version.
let SW_META_VERSION = null;
try {
  importScripts("/sw-meta.js");
  SW_META_VERSION = typeof self !== "undefined" ? self.__SW_META_VERSION__ ?? null : null;
} catch (error) {
  // Ignore failures (offline, cold start). Fallback to the URL tag below.
}

const SW_VERSION = (() => {
  if (typeof SW_META_VERSION === "string" && SW_META_VERSION.trim().length > 0) {
    return SW_META_VERSION.trim();
  }
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
const OFFLINE_FALLBACK_URL = "/__sw-offline-fallback";
const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>読み込みに失敗しました</title>
    <style>
      :root { color-scheme: dark; }
      html, body { height: 100%; margin: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        background: radial-gradient(1200px 800px at 20% 10%, rgba(32, 64, 120, 0.35), transparent 60%),
          radial-gradient(900px 700px at 80% 40%, rgba(120, 48, 64, 0.25), transparent 60%),
          linear-gradient(135deg, rgba(8, 9, 15, 0.98), rgba(12, 14, 22, 0.98));
        color: rgba(245, 247, 250, 0.95);
        display: grid;
        place-items: center;
      }
      .panel {
        width: min(560px, calc(100vw - 2rem));
        padding: 1.25rem 1.1rem;
        border-radius: 16px;
        background: rgba(8, 9, 15, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
      }
      h1 { margin: 0 0 0.5rem; font-size: 1.1rem; }
      p { margin: 0.35rem 0; line-height: 1.5; color: rgba(245, 247, 250, 0.82); }
      .row { display: flex; gap: 0.6rem; margin-top: 0.9rem; flex-wrap: wrap; }
      button {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.08);
        color: rgba(245, 247, 250, 0.95);
        padding: 0.6rem 0.85rem;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      button:active { transform: translateY(1px); }
      .muted { color: rgba(245, 247, 250, 0.6); font-size: 0.9rem; }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        background: rgba(255, 255, 255, 0.06);
        padding: 0.08rem 0.35rem;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <div class="panel">
      <h1>読み込みに失敗しました</h1>
      <p>ネットワークが不安定、または更新中の可能性があります。</p>
      <p class="muted">この画面は Service Worker の復旧用フォールバックです。</p>
      <div class="row">
        <button id="reload" type="button">再読み込み</button>
      </div>
      <p class="muted" id="status"></p>
      <p class="muted">ヒント: 機内モード→解除、または Wi‑Fi/4G/5G を切り替えると直ることがあります。</p>
    </div>
    <script>
      (function () {
        var btn = document.getElementById("reload");
        var status = document.getElementById("status");
        var didReload = false;
        function setStatus(text) { if (status) status.textContent = text; }
        function reload() {
          if (didReload) return;
          didReload = true;
          try { setStatus("再読み込みしています…"); } catch (e) {}
          location.reload();
        }
        if (btn) btn.addEventListener("click", reload, { passive: true });
        window.addEventListener("online", function () {
          setStatus("接続が戻りました。再読み込みします…");
          reload();
        }, { passive: true });

        // Wake-from-sleep 等で一時的に失敗するケース向けに、限定回数だけ自動で疎通確認→復旧を試す。
        var tries = 0;
        var maxTries = 3;
        function probe() {
          if (tries >= maxTries) return;
          tries += 1;
          fetch("/sw-meta.js", { cache: "no-store" })
            .then(function (res) { if (res && res.ok) reload(); })
            .catch(function () {})
            .finally(function () {
              if (!didReload && tries < maxTries) {
                setStatus("接続を確認しています… (" + tries + "/" + maxTries + ")");
                setTimeout(probe, 1200 * tries);
              }
            });
        }
        probe();
      })();
    </script>
  </body>
</html>`;

const buildOfflineFallbackResponse = () =>
  new Response(OFFLINE_FALLBACK_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Avoid caching this document at the HTTP layer; the SW cache is the source of truth.
      "Cache-Control": "no-store",
    },
  });

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
  // Always provide a non-empty offline/update recovery page for navigation fallbacks.
  // This prevents "blank screen" failures when the first navigation after wake/update is offline.
  try {
    await cache.put(OFFLINE_FALLBACK_URL, buildOfflineFallbackResponse());
  } catch {
    /* ignore */
  }
  await Promise.allSettled(
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
    // Notify is best-effort; never block skipWaiting on cross-client plumbing.
    // In some scenarios (e.g. heavy worker clients) `clients.matchAll()` can stall, which would keep
    // the SW stuck in `installed` and make Safe Update time out.
    void notifyUpdateChannels("update-applying");
    event.waitUntil(self.skipWaiting());
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
      // Claim clients first so "Safe Update" can complete quickly even when cache cleanup is slow
      // (e.g. after visiting heavy routes that cached many assets).
      await self.clients.claim().catch(() => undefined);
      await notifyUpdateChannels("update-applied");

      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
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
          const cachedPage = await cache.match(request);
          if (cachedPage) return cachedPage;
          const fallback = await cache.match(OFFLINE_FALLBACK_URL);
          if (fallback) return fallback;
          return buildOfflineFallbackResponse();
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

