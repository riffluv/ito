const rawVersion =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_APP_VERSION : undefined) ??
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SW_VERSION : undefined) ??
  null;
const commitSha =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA : undefined) ??
  (typeof process !== "undefined" ? process.env.VERCEL_GIT_COMMIT_SHA : undefined) ??
  null;

// Next.js の buildId（クライアントで __NEXT_DATA__.buildId として取れる）が
// commit/APP_VERSION とれない場合のフォールバックとして使える。
const runtimeBuildId =
  typeof window !== "undefined" && typeof window.__NEXT_DATA__ === "object"
    ? window.__NEXT_DATA__.buildId ?? null
    : typeof window !== "undefined" && typeof (window as { __nextBuildId?: string }).__nextBuildId === "string"
      ? (window as { __nextBuildId?: string }).__nextBuildId ?? null
      : typeof process !== "undefined"
        ? process.env.NEXT_BUILD_ID ?? null
        : null;

const shortCommit = commitSha ? commitSha.slice(0, 7) : null;

let resolved: string | null = null;
const isProd = typeof process !== "undefined" && process.env.NODE_ENV === "production";

if (shortCommit) {
  resolved =
    rawVersion && rawVersion.trim().length > 0
      ? `${rawVersion.trim()} (${shortCommit})`
      : shortCommit;
} else if (rawVersion && rawVersion.trim().length > 0) {
  resolved = rawVersion.trim();
} else if (runtimeBuildId && isProd) {
  resolved = runtimeBuildId;
}

export const APP_VERSION: string = resolved ?? "dev";
