export function extractVersionTag(
  registration: ServiceWorkerRegistration
): string | null {
  const candidate =
    registration.waiting ?? registration.installing ?? registration.active ?? null;
  if (!candidate) {
    return null;
  }
  try {
    const url = new URL(candidate.scriptURL);
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

// Applying an update can take longer than expected when large caches are being purged during SW activation
// or when a hard-reload fallback is in-flight on slow devices/networks.
export const APPLY_TIMEOUT_MS = 45_000;
// Shorten auto-apply window to reduce time users can stay on an old build.
export const AUTO_APPLY_DELAY_MS = 15_000;
export const AUTO_APPLY_REASON = "auto-timer";

