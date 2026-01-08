export function buildPixiWorkerUrl(): string | null {
  if (typeof window === "undefined") return null;

  const assetPrefix =
    (globalThis as typeof globalThis & {
      __NEXT_DATA__?: { assetPrefix?: string };
    }).__NEXT_DATA__?.assetPrefix ??
    process.env.NEXT_PUBLIC_ASSET_PREFIX ??
    "";

  const prefix = assetPrefix.replace(/\/$/, "");
  const base = /^https?:\/\//i.test(prefix)
    ? prefix
    : `${window.location.origin}${prefix}`;

  const cacheBust = process.env.NEXT_PUBLIC_APP_VERSION
    ? `?v=${process.env.NEXT_PUBLIC_APP_VERSION}`
    : "";

  return `${base}/workers/pixi-background-worker.js${cacheBust}`;
}

