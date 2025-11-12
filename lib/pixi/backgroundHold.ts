export type ReleaseBackgroundHold = () => void;
export type AcquireBackgroundHold = () => ReleaseBackgroundHold | undefined;

/**
 * Ensures that background hold handles acquired from PixiHudStage
 * are released exactly once even if multiple callers try to release them.
 */
export function createBackgroundHoldController(
  acquire?: AcquireBackgroundHold
) {
  let releaseHandle = acquire?.();
  return {
    release() {
      if (releaseHandle) {
        releaseHandle();
        releaseHandle = undefined;
      }
    },
  };
}
