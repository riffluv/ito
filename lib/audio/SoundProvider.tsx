"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SoundManager } from "./SoundManager";
import { SOUND_LIBRARY } from "./registry";
import { DEFAULT_SOUND_SETTINGS, SoundId, SoundSettings } from "./types";
import { setGlobalSoundManager } from "./global";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";

interface SoundContextValue {
  manager: SoundManager | null;
  settings: SoundSettings;
}

const context = createContext<SoundContextValue>({
  manager: null,
  settings: DEFAULT_SOUND_SETTINGS,
});

const PREWARM_SOUND_IDS: SoundId[] = SOUND_LIBRARY.filter((sound) => sound.preload?.decode).map((sound) => sound.id);
const CRITICAL_PREWARM_IDS = new Set<SoundId>([
  "ui_click",
  "card_flip",
  "card_place",
  "card_deal",
  "drag_pickup",
  "drop_success",
  "drop_invalid",
  "clue_decide",
  "order_confirm",
]);
const CONSTRAINED_PREWARM_IDS = new Set<SoundId>(["ui_click", "card_flip", "card_place"]);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<SoundManager | null>(null);
  if (managerRef.current === null && typeof window !== "undefined") {
    managerRef.current = new SoundManager();
  }

  const [settings, setSettings] = useState<SoundSettings>(
    managerRef.current?.getSettings() ?? DEFAULT_SOUND_SETTINGS
  );

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    setGlobalSoundManager(manager);

    const unsubscribe = manager.subscribe((event) => {
      if (event.type === "settings") {
        setSettings(event.settings);
      }
    });

    return () => {
      unsubscribe();
      setGlobalSoundManager(null);
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  // 軽量ウォームアップ（フラグON時のみ、初回入力/可視化で一度だけ）
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PERF_WARMUP !== "1") return;
    const mgr = managerRef.current;
    if (!mgr) return;
    const didWarmRef = { current: false };

    const candidates = [
      "card_flip",
      "ui_click",
      "drag_pickup",
    ] as SoundId[];
    const prewarmIds: SoundId[] = candidates.filter((id) =>
      (PREWARM_SOUND_IDS as ReadonlyArray<SoundId>).includes(id)
    );

    const runWarmup = async () => {
      if (didWarmRef.current) return;
      didWarmRef.current = true;
      try {
        await mgr.warmup();
        if (prewarmIds.length) {
          await mgr.prewarm(prewarmIds);
        }
        setMetric("perf", "warmup.audio", 1);
        traceAction("warmup.audio");
      } catch (error) {
        console.warn("[SoundProvider] warmup failed", error);
        traceError("warmup.audio", error as any);
      } finally {
        detach();
      }
    };

    const onPointerDown = () => void runWarmup();
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void runWarmup();
      }
    };
    const detach = () => {
      if (typeof window === "undefined") return;
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
      document.addEventListener("visibilitychange", onVisibility, { passive: true } as any);
    }
    return detach;
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    if (PREWARM_SOUND_IDS.length === 0) return;

    const connection =
      typeof navigator !== "undefined" ? ((navigator as any).connection ?? null) : null;
    const effectiveType =
      typeof connection?.effectiveType === "string"
        ? String(connection.effectiveType).toLowerCase()
        : "";
    const constrainedNetwork =
      !!connection &&
      (connection.saveData === true ||
        ["slow-2g", "2g", "3g"].includes(effectiveType));
    setMetric("audio", "prewarm.constrained", constrainedNetwork ? 1 : 0);

    const criticalSet = constrainedNetwork ? CONSTRAINED_PREWARM_IDS : CRITICAL_PREWARM_IDS;
    const critical = PREWARM_SOUND_IDS.filter((id) => criticalSet.has(id));
    const deferred = constrainedNetwork
      ? []
      : PREWARM_SOUND_IDS.filter((id) => !criticalSet.has(id));
    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    if (critical.length) {
      void (async () => {
        const startedAt =
          typeof performance !== "undefined" ? performance.now() : null;
        try {
          await manager.prewarm(critical);
          if (startedAt !== null) {
            setMetric(
              "audio",
              "prewarm.criticalMs",
              Math.round(performance.now() - startedAt)
            );
          }
        } catch (error) {
          setMetric("audio", "prewarm.criticalMs", -1);
          traceError("audio.prewarm.critical", error as any);
        }
      })();
    } else {
      setMetric("audio", "prewarm.criticalMs", 0);
    }

    if (deferred.length) {
      const win = window as Window &
        typeof globalThis & {
          requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
          cancelIdleCallback?: (handle: number) => void;
        };
      const queue = [...deferred];
      const totalStartedAt =
        typeof performance !== "undefined" ? performance.now() : null;

      const runNext = () => {
        idleHandle = undefined;
        timeoutHandle = undefined;
        if (cancelled) return;
        const soundId = queue.shift();
        if (!soundId) return;
        const soundStartedAt =
          typeof performance !== "undefined" ? performance.now() : null;
        manager
          .prewarm([soundId])
          .catch((error) => {
            traceError("audio.prewarm.deferred", error as any, { soundId });
          })
          .finally(() => {
            if (soundStartedAt !== null) {
              setMetric(
                "audio",
                `prewarm.sound.${soundId}`,
                Math.round(performance.now() - soundStartedAt)
              );
            }
            if (queue.length === 0) {
              if (totalStartedAt !== null) {
                setMetric(
                  "audio",
                  "prewarm.deferredMs",
                  Math.round(performance.now() - totalStartedAt)
                );
              }
              return;
            }
            if (!cancelled) {
              scheduleNext(queue.length > 2 ? 480 : 260);
            }
          });
      };

      const scheduleNext = (delayMs: number) => {
        if (cancelled || queue.length === 0) return;
        const invoke = () => {
          runNext();
        };
        if (typeof win.requestIdleCallback === "function") {
          if (delayMs > 0) {
            timeoutHandle = window.setTimeout(() => {
              timeoutHandle = undefined;
              if (cancelled) return;
              idleHandle = win.requestIdleCallback(invoke, { timeout: 2500 });
            }, Math.max(delayMs, 120));
          } else {
            idleHandle = win.requestIdleCallback(invoke, { timeout: 2500 });
          }
        } else {
          timeoutHandle = window.setTimeout(invoke, Math.max(delayMs, 150));
        }
      };

      scheduleNext(0);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        if (idleHandle !== undefined) {
          (window as any).cancelIdleCallback?.(idleHandle);
        }
        if (timeoutHandle !== undefined) {
          window.clearTimeout(timeoutHandle);
        }
      }
    };
  }, []);

  const value = useMemo<SoundContextValue>(() => ({
    manager: managerRef.current,
    settings,
  }), [settings]);

  return <context.Provider value={value}>{children}</context.Provider>;
}

export const useSoundContext = () => {
  const value = useContext(context);
  if (!value) {
    throw new Error("useSoundContext must be used within SoundProvider");
  }
  return value;
};

export const useSoundManager = () => useSoundContext().manager;

export const useSoundSettings = () => useSoundContext().settings;
