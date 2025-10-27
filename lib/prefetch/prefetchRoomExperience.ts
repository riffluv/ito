import { getGlobalSoundManager, subscribeGlobalSoundManager } from "@/lib/audio/global";
import type { SoundId } from "@/lib/audio/types";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { sanitizeRoom } from "@/lib/state/sanitize";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { doc, getDoc } from "firebase/firestore";

type PrefetchOptions = {
  priority?: boolean;
};

const PREFETCH_SOUND_IDS: SoundId[] = [
  "card_deal",
  "drag_pickup",
  "drop_success",
  "order_confirm",
];

const ROOM_PREFETCH_PREFIX = "ito:prefetch:room:";
export const ROOM_PREFETCH_TTL_MS = 15_000;
const TIMESTAMP_KEY = "__ito_ts";

const pending = new Map<string, Promise<void>>();

const isBrowser = () => typeof window !== "undefined";

const createTimestampStub = (ms: number) =>
  Object.freeze({
    toMillis: () => ms,
    valueOf: () => ms,
    toJSON: () => ms,
  });

const replacer = (_key: string, value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    try {
      const millis = (value as { toMillis: () => number }).toMillis();
      return { [TIMESTAMP_KEY]: millis };
    } catch {
      return value;
    }
  }
  if (value instanceof Date) {
    return { [TIMESTAMP_KEY]: value.getTime() };
  }
  return value;
};

const reviver = (_key: string, value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    TIMESTAMP_KEY in (value as Record<string, unknown>)
  ) {
    const ms = Number((value as Record<string, unknown>)[TIMESTAMP_KEY]);
    if (Number.isFinite(ms)) {
      return createTimestampStub(ms);
    }
  }
  return value;
};

const getRoomCacheKey = (roomId: string) => `${ROOM_PREFETCH_PREFIX}${roomId}`;

export function storePrefetchedRoom(roomId: string, room: Record<string, unknown> | null) {
  if (!isBrowser() || !roomId) return;
  const key = getRoomCacheKey(roomId);
  if (!room) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {}
    return;
  }
  try {
    const payload = JSON.stringify(
      {
        ts: Date.now(),
        room,
      },
      replacer
    );
    window.sessionStorage.setItem(key, payload);
  } catch (error) {
    traceError("prefetch.room.store", error as Error, { roomId });
  }
}

export function loadPrefetchedRoom(roomId: string): Record<string, unknown> | null {
  if (!isBrowser() || !roomId) return null;
  try {
    const raw = window.sessionStorage.getItem(getRoomCacheKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw, reviver) as { ts?: number; room?: Record<string, unknown> };
    if (!parsed || typeof parsed.ts !== "number" || !parsed.room) {
      window.sessionStorage.removeItem(getRoomCacheKey(roomId));
      return null;
    }
    if (Date.now() - parsed.ts > ROOM_PREFETCH_TTL_MS) {
      window.sessionStorage.removeItem(getRoomCacheKey(roomId));
      return null;
    }
    return parsed.room;
  } catch (error) {
    traceError("prefetch.room.load", error as Error, { roomId });
    return null;
  }
}

function prewarmAudio(soundIds: SoundId[]): Promise<void> {
  if (!isBrowser()) return Promise.resolve();
  const manager = getGlobalSoundManager();
  if (manager) {
    return manager.prewarm(soundIds);
  }

  return new Promise<void>((resolve) => {
    const timeoutHandle = isBrowser()
      ? window.setTimeout(() => {
          unsubscribe();
          resolve();
        }, 300)
      : null;

    const unsubscribe = subscribeGlobalSoundManager((instance) => {
      if (!instance) return;
      unsubscribe();
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
      instance
        .prewarm(soundIds)
        .catch((error) => {
          traceError("prefetch.room.audio", error as Error);
        })
        .finally(() => resolve());
    });
  });
}

async function prefetchRoomSnapshot(roomId: string, priority = false): Promise<void> {
  if (!firebaseEnabled || !db || !isBrowser()) return;
  const existing = loadPrefetchedRoom(roomId);
  if (existing && !priority) {
    return;
  }
  try {
    const snapshotStart = typeof performance !== "undefined" ? performance.now() : null;
    const snap = await getDoc(doc(db, "rooms", roomId));
    if (!snap.exists()) {
      return;
    }
    const sanitized = sanitizeRoom(snap.data());
    storePrefetchedRoom(roomId, sanitized as unknown as Record<string, unknown>);
    if (snapshotStart !== null) {
      setMetric(
        "prefetch",
        "room.snapshotMs",
        Math.max(0, Math.round(performance.now() - snapshotStart))
      );
    }
  } catch (error) {
    traceError("prefetch.room.snapshot", error as Error, { roomId });
  }
}

export function prefetchRoomExperience(roomId: string, opts: PrefetchOptions = {}): Promise<void> {
  if (!isBrowser() || !roomId) {
    return Promise.resolve();
  }

  const key = `${roomId}:${opts.priority ? "p" : "n"}`;
  const cached = pending.get(key);
  if (cached) {
    return cached;
  }

  const task = (async () => {
    const startedAt = typeof performance !== "undefined" ? performance.now() : null;

    try {
      const soundIds = opts.priority
        ? PREFETCH_SOUND_IDS
        : PREFETCH_SOUND_IDS.slice(0, 3);
      await Promise.all([
        prewarmAudio(soundIds),
        prefetchRoomSnapshot(roomId, !!opts.priority),
      ]);
      if (startedAt !== null) {
        setMetric(
          "prefetch",
          opts.priority ? "room.highPriorityAudioMs" : "room.audioMs",
          Math.max(0, Math.round(performance.now() - startedAt))
        );
      }
      traceAction("prefetch.roomExperience", {
        roomId,
        mode: opts.priority ? "priority" : "standard",
      });
    } catch (error) {
      traceError("prefetch.roomExperience", error as Error, { roomId });
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, task);
  return task;
}
