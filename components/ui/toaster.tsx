"use client";
// Single no-op toaster stub to completely disable visual toasts while preserving the
// API surface used across the codebase (so existing `toaster.create(...)` calls do nothing).
// This prevents runtime errors and keeps call sites unchanged.

export const toaster = {
  create: (_opts: any) => undefined,
  dismiss: (_id?: any) => undefined,
  promise: async (p: Promise<any>, _opts?: any) => {
    try {
      return await p;
    } catch (err) {
      // swallow errors from the wrapped promise to preserve previous behaviour where
      // callers may have awaited toaster.promise(...). Consumers should not rely on UI side-effects.
      return undefined;
    }
  },
};

export function Toaster(): null {
  // Intentionally render nothing — the app should not show any toasts.
  return null;
}
