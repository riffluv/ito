const DEFAULT_TIMEOUT_MS = 48;

/**
 * Await the next animation frame, but fall back to a timeout so we don't hang
 * when requestAnimationFrame never resolves (e.g. software rendering paths).
 */
export function waitForNextFrame(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      setTimeout(resolve, timeoutMs);
      return;
    }

    let settled = false;
    let rafId: number | null = null;
    let timeoutId: number | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (rafId !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafId);
      }
      resolve();
    };

    if (typeof window.requestAnimationFrame === "function") {
      rafId = window.requestAnimationFrame(() => {
        finish();
      });
    }

    timeoutId = window.setTimeout(finish, timeoutMs);
  });
}
