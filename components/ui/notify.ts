// Lightweight notification shim.
// Exposes `notify` and `notifyPromise` so caller sites can be updated to use this
// instead of the `toaster` API. Currently no-op to avoid UI popups.

export type NotifyOptions = {
  title?: string;
  description?: string;
  type?: "info" | "warning" | "success" | "error";
  duration?: number;
  id?: string | number;
  [key: string]: any;
};

export function notify(_opts: NotifyOptions | string): void {
  // no-op intentionally
}

export async function notifyPromise<T>(
  p: Promise<T>,
  _opts?: NotifyOptions
): Promise<T | undefined> {
  try {
    return await p;
  } catch (err) {
    // swallow to preserve old behavior where the promise was used for UI lifecycle
    return undefined;
  }
}
