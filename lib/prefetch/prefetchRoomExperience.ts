import { getGlobalSoundManager, subscribeGlobalSoundManager } from "@/lib/audio/global";
import type { SoundId } from "@/lib/audio/types";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";

type PrefetchOptions = {
  priority?: boolean;
};

const PREFETCH_SOUND_IDS: SoundId[] = [
  "card_deal",
  "drag_pickup",
  "drop_success",
  "order_confirm",
];

const pending = new Map<string, Promise<void>>();

function prewarmAudio(soundIds: SoundId[]): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const manager = getGlobalSoundManager();
  if (manager) {
    return manager.prewarm(soundIds);
  }

  return new Promise<void>((resolve) => {
    const timeoutHandle =
      typeof window !== "undefined"
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

export function prefetchRoomExperience(roomId: string, opts: PrefetchOptions = {}): Promise<void> {
  if (typeof window === "undefined" || !roomId) {
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
      await prewarmAudio(soundIds);
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

