const env = (typeof process !== "undefined" ? process.env : {}) as {
  NEXT_PUBLIC_APP_VERSION?: string;
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
};

const rawVersion = env.NEXT_PUBLIC_APP_VERSION ?? null;
const commitSha =
  env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? env.VERCEL_GIT_COMMIT_SHA ?? null;

// Next.js の buildId（クライアントで __NEXT_DATA__.buildId として取れる）が
// commit/APP_VERSION とれない場合のフォールバックとして使える。
const runtimeBuildId =
  typeof window !== "undefined" && typeof window.__NEXT_DATA__ === "object"
    ? window.__NEXT_DATA__.buildId ?? null
    : null;

const shortCommit = commitSha ? commitSha.slice(0, 7) : null;

let resolved: string | null = null;

if (shortCommit) {
  resolved =
    rawVersion && rawVersion.trim().length > 0
      ? `${rawVersion.trim()} (${shortCommit})`
      : shortCommit;
} else if (rawVersion && rawVersion.trim().length > 0) {
  resolved = rawVersion.trim();
} else if (runtimeBuildId) {
  resolved = runtimeBuildId;
}

export const APP_VERSION: string = resolved ?? "dev";
