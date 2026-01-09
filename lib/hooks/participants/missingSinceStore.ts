import type { MissingSinceStore } from "@/lib/presence/stableOnline";

declare global {
  interface Window {
    /**
     * ルームIDごとの「offline検知時刻」キャッシュ
     * window.__missingSince[roomId][uid] = timestamp
     */
    __missingSince?: Record<string, Record<string, number>>;
  }
}

export function readMissingSinceStore(roomId?: string | null): MissingSinceStore {
  if (typeof window === "undefined" || !roomId) return {};
  try {
    const roomStore = window.__missingSince?.[roomId];
    if (roomStore && typeof roomStore === "object") {
      return Object.entries(roomStore).reduce<MissingSinceStore>(
        (acc, [uid, ts]) => {
          if (typeof ts === "number" && Number.isFinite(ts)) {
            acc[uid] = ts;
          }
          return acc;
        },
        {}
      );
    }
  } catch {}
  return {};
}

export function writeMissingSinceStore(
  roomId: string,
  store: MissingSinceStore
): void {
  if (typeof window === "undefined" || !roomId) return;
  try {
    if (!window.__missingSince) {
      window.__missingSince = {};
    }
    window.__missingSince[roomId] = { ...store };
  } catch {}
}
