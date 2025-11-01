const rawVersion =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_VERSION) ||
  null;

const commitSha =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA) ||
  null;

const shortCommit = commitSha ? commitSha.slice(0, 7) : null;

let resolved: string | null = null;

if (rawVersion && rawVersion.trim().length > 0) {
  resolved = shortCommit ? `${rawVersion.trim()} (${shortCommit})` : rawVersion.trim();
} else if (shortCommit) {
  resolved = shortCommit;
}

export const APP_VERSION: string = resolved ?? "dev";
