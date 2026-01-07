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
  "card_flip",
  "card_deal",
  "card_place",
  "drop_success",
  "order_confirm",
];

const ROOM_PREFETCH_PREFIX = "ito:prefetch:room:";
export const ROOM_PREFETCH_TTL_MS = 15_000;
const TIMESTAMP_KEY = "__ito_ts";

const pending = new Map<string, Promise<void>>();
const PREFETCH_RETRY_LIMIT = 3;
const PREFETCH_RETRY_DELAY_MS = 600;

type RecoveryEntry = {
  opts: PrefetchOptions;
  retries: number;
  timer: number | null;
};

const recoveryEntries = new Map<string, RecoveryEntry>();
let recoveryDetach: (() => void) | null = null;

const isBrowser = () => typeof window !== "undefined";

const pendingKeyVariants = (roomId: string) => [`${roomId}:p`, `${roomId}:n`];

const cleanupRecoveryListeners = () => {
  if (!recoveryDetach) return;
  recoveryDetach();
  recoveryDetach = null;
};

const ensureRecoveryListeners = () => {
  if (!isBrowser() || recoveryDetach) return;
  const triggerPointer = () => triggerRecovery("pointer");
  const triggerVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      triggerRecovery("visibility");
    }
  };
  window.addEventListener("pointerdown", triggerPointer, { passive: true });
  document.addEventListener(
    "visibilitychange",
    triggerVisibility,
    { passive: true } as AddEventListenerOptions
  );
  recoveryDetach = () => {
    window.removeEventListener("pointerdown", triggerPointer);
    document.removeEventListener("visibilitychange", triggerVisibility);
  };
};

const triggerRecovery = (_reason: "timeout" | "pointer" | "visibility") => {
  if (!isBrowser() || recoveryEntries.size === 0) {
    cleanupRecoveryListeners();
    return;
  }
  const entries = Array.from(recoveryEntries.entries());
  entries.forEach(([roomId, entry]) => {
    const [priorityKey, normalKey] = pendingKeyVariants(roomId);
    if (pending.has(priorityKey) || pending.has(normalKey)) {
      return;
    }
    if (entry.retries >= PREFETCH_RETRY_LIMIT) {
      recoveryEntries.delete(roomId);
      if (entry.timer !== null) {
        window.clearTimeout(entry.timer);
      }
      return;
    }
    entry.retries += 1;
    entry.timer = null;
    void prefetchRoomExperience(roomId, { ...entry.opts, priority: true });
  });
  if (recoveryEntries.size === 0) {
    cleanupRecoveryListeners();
  }
};

const scheduleRecovery = (roomId: string, opts: PrefetchOptions) => {
  if (!isBrowser()) return;
  const existing = recoveryEntries.get(roomId);
  const merged: PrefetchOptions = {
    priority: opts.priority || existing?.opts.priority || false,
  };
  if (existing) {
    existing.opts = merged;
    if (existing.timer === null) {
      existing.timer = window.setTimeout(() => {
        existing.timer = null;
        triggerRecovery("timeout");
      }, PREFETCH_RETRY_DELAY_MS);
    }
    return;
  }
  const entry: RecoveryEntry = {
    opts: merged,
    retries: 0,
    timer: null,
  };
  recoveryEntries.set(roomId, entry);
  ensureRecoveryListeners();
  entry.timer = window.setTimeout(() => {
    entry.timer = null;
    triggerRecovery("timeout");
  }, PREFETCH_RETRY_DELAY_MS);
};

const clearRecovery = (roomId: string) => {
  const entry = recoveryEntries.get(roomId);
  if (!entry) return;
  if (entry.timer !== null) {
    window.clearTimeout(entry.timer);
  }
  recoveryEntries.delete(roomId);
  if (recoveryEntries.size === 0) {
    cleanupRecoveryListeners();
  }
};

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

function prewarmAudio(soundIds: SoundId[]): Promise<boolean> {
  if (!isBrowser()) return Promise.resolve(true);
  const manager = getGlobalSoundManager();
  if (manager) {
    return manager
      .prewarm(soundIds)
      .then(() => true)
      .catch((error) => {
        traceError("prefetch.room.audio", error as Error);
        return false;
      });
  }

  return new Promise<boolean>((resolve) => {
    const timeoutHandle = isBrowser()
      ? window.setTimeout(() => {
          unsubscribe();
          resolve(false);
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
        .then(() => {
          if (timeoutHandle !== null) {
            window.clearTimeout(timeoutHandle);
          }
          resolve(true);
        })
        .catch((error) => {
          if (timeoutHandle !== null) {
            window.clearTimeout(timeoutHandle);
          }
          traceError("prefetch.room.audio", error as Error);
          resolve(false);
        })
        .finally(() => undefined);
    });
  });
}

async function prefetchRoomSnapshot(roomId: string, priority = false): Promise<boolean> {
  if (!isBrowser()) return false;
  if (!firebaseEnabled || !db) return true;
  const existing = loadPrefetchedRoom(roomId);
  if (existing && !priority) {
    return true;
  }
  try {
    const snapshotStart = typeof performance !== "undefined" ? performance.now() : null;
    const snap = await getDoc(doc(db, "rooms", roomId));
    if (!snap.exists()) {
      return false;
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
    return true;
  } catch (error) {
    traceError("prefetch.room.snapshot", error as Error, { roomId });
    return false;
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
    let audioReady = false;
    let snapshotReady = false;

    try {
      const soundIds = opts.priority
        ? PREFETCH_SOUND_IDS
        : PREFETCH_SOUND_IDS.slice(0, 3);
      const results = await Promise.all([
        prewarmAudio(soundIds),
        prefetchRoomSnapshot(roomId, !!opts.priority),
      ]);
      audioReady = results[0];
      snapshotReady = results[1];
      if (startedAt !== null && audioReady && snapshotReady) {
        setMetric(
          "prefetch",
          opts.priority ? "room.highPriorityAudioMs" : "room.audioMs",
          Math.max(0, Math.round(performance.now() - startedAt))
        );
      }
    } catch (error) {
      traceError("prefetch.roomExperience", error as Error, { roomId });
    } finally {
      pending.delete(key);
    }

    const success = audioReady && snapshotReady;
    if (success) {
      clearRecovery(roomId);
    } else {
      scheduleRecovery(roomId, opts);
    }
    traceAction("prefetch.roomExperience", {
      roomId,
      mode: opts.priority ? "priority" : "standard",
      success,
      audioReady,
      snapshotReady,
    });
  })();

  pending.set(key, task);
  return task;
}
