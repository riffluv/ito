const rawVersion =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_VERSION) || null;

const commitSha =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA) || null;

const shortCommit = commitSha ? commitSha.slice(0, 7) : null;

let resolved: string | null = null;

// commit を最優先にして、同じ APP_VERSION が固定値でも SW のバージョンが動くようにする
if (shortCommit) {
  resolved = rawVersion && rawVersion.trim().length > 0
    ? `${rawVersion.trim()} (${shortCommit})`
    : shortCommit;
} else if (rawVersion && rawVersion.trim().length > 0) {
  resolved = rawVersion.trim();
}

export const APP_VERSION: string = resolved ?? "dev";
