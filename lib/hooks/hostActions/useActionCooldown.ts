import { useCallback, type MutableRefObject } from "react";

export function useActionCooldown(params: {
  cooldownMs: number;
  lastActionAtRef: MutableRefObject<Record<string, number>>;
}): (key: string) => boolean {
  const { cooldownMs, lastActionAtRef } = params;

  return useCallback(
    (key: string) => {
      const now = Date.now();
      const last = lastActionAtRef.current[key] ?? 0;
      if (now - last < cooldownMs) {
        return false;
      }
      lastActionAtRef.current[key] = now;
      return true;
    },
    [cooldownMs, lastActionAtRef]
  );
}

