import { logInfo } from "@/lib/utils/log";

type FreezeTrackerSource = "presence" | "fallback";
export type FreezeTracker = {
  start: (roomId: string, now: number, freezeUntil: number, freezeMs: number) => void;
  end: (roomId: string, now: number) => void;
};

export function createFreezeTracker(source: FreezeTrackerSource): FreezeTracker {
  const startedAt: Record<string, number> = {};
  return {
    start(roomId, now, _freezeUntil, freezeMs) {
      if (startedAt[roomId]) return;
      startedAt[roomId] = now;
      logInfo("useLobbyCounts", "zero-freeze-start", {
        roomId,
        source,
        freezeMs,
      });
    },
    end(roomId, now) {
      const started = startedAt[roomId];
      if (started === undefined) return;
      const durationMs = Math.max(now - started, 0);
      delete startedAt[roomId];
      logInfo("useLobbyCounts", "zero-freeze-end", {
        roomId,
        source,
        durationMs,
      });
    },
  };
}
