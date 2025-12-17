const port = Number(process.env.PLAYWRIGHT_PORT || 3100);

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.BASE_URL ||
  `http://localhost:${port}`;

const waitMs = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForServer(url: string, timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetchWithTimeout(url, { method: "GET" }, 8000);
      if (res.ok) return;
    } catch {
      // retry
    }
    await waitMs(1000);
  }
  throw new Error(`playwright: server did not become ready in ${timeoutMs}ms: ${url}`);
}

async function waitForNextAssetsReady(url: string, timeoutMs: number) {
  const startedAt = Date.now();

  let html = "";
  try {
    const res = await fetchWithTimeout(`${url}/`, { method: "GET" }, 30_000);
    html = await res.text();
  } catch {
    html = "";
  }

  const assets = new Set<string>();
  const tagPattern = /(?:src|href)="(\/_next\/static\/[^"?]+)(?:\?[^"]*)?"/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    const path = match[1];
    if (!path) continue;
    if (path.endsWith(".js") || path.endsWith(".css")) {
      assets.add(path);
    }
  }

  // Fallback: dev server always needs these chunks for hydration.
  [
    "/_next/static/chunks/main-app.js",
    "/_next/static/chunks/app-pages-internals.js",
  ].forEach((path) => assets.add(path));

  const pending = new Set(Array.from(assets));

  while (pending.size > 0 && Date.now() - startedAt < timeoutMs) {
    await Promise.all(
      Array.from(pending).map(async (path) => {
        try {
          const res = await fetchWithTimeout(`${url}${path}`, { method: "GET" }, 10_000);
          if (res.ok) {
            pending.delete(path);
          }
        } catch {
          // retry
        }
      })
    );
    if (pending.size === 0) break;
    await waitMs(1000);
  }

  if (pending.size > 0) {
    throw new Error(
      `playwright: Next.js assets did not become ready in ${timeoutMs}ms: ${Array.from(pending)
        .slice(0, 10)
        .join(", ")}`
    );
  }
}

async function warmUpNextCompilation(url: string) {
  const targets: Array<{ path: string; method: "GET" | "POST"; body?: unknown }> = [
    { path: "/", method: "GET" },
    { path: "/rooms/__playwright_warmup__", method: "GET" },
    // API routes: compile by probing with GET (most are POST-only, so 405 is fine)
    { path: "/api/rooms/__playwright_warmup__/join", method: "GET" },
    { path: "/api/rooms/__playwright_warmup__/start", method: "GET" },
    { path: "/api/rooms/__playwright_warmup__/reset", method: "GET" },
  ];

  for (const target of targets) {
    const full = `${url}${target.path}`;
    try {
      await fetchWithTimeout(
        full,
        target.method === "POST"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(target.body ?? {}),
            }
          : { method: "GET" },
        60_000
      );
    } catch {
      // warm-up is best-effort; failures should not block tests
    }
  }
}

export default async function globalSetup() {
  await waitForServer(baseURL, 120_000);
  await waitForNextAssetsReady(baseURL, 150_000);
  await warmUpNextCompilation(baseURL);
}
