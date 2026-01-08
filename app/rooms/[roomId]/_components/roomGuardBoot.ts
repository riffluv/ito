"use client";

import { useAssetPreloader } from "@/hooks/useAssetPreloader";
import type { SoundManager } from "@/lib/audio/SoundManager";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { resyncWaitingServiceWorker } from "@/lib/serviceWorker/updateChannel";
import { setMetric } from "@/lib/utils/metrics";
import { initMetricsExport } from "@/lib/utils/metricsExport";
import { useEffect, useState } from "react";

const ROOM_CORE_ASSETS = [
  "/images/flag.webp",
  "/images/flag2.webp",
  "/images/flag3.webp",
  "/images/card1.webp",
  "/images/card2.webp",
  "/images/card3.webp",
  "/images/hanepen1.webp",
  "/images/hanepen2.webp",
  "/images/backgrounds/hd2d/bg1.png",
] as const;

const PREFETCH_COMPONENT_LOADERS: Array<() => Promise<unknown>> = [
  () => import("@/components/SettingsModal"),
  () => import("@/components/ui/MinimalChat"),
  () =>
    import("@/components/RoomPasswordPrompt").then((mod) => mod.RoomPasswordPrompt),
  () => import("@/components/ui/Tooltip"),
];

type ConnectionInfo = {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type NavigatorWithConnection = Navigator & { connection?: ConnectionInfo | null };

export function useRoomGuardMetricsBootstrap() {
  useEffect(() => {
    initMetricsExport();
  }, []);
  useEffect(() => {
    setMetric("safeUpdate", "deferred", 0);
    setMetric("safeUpdate", "applied", 0);
  }, []);
  useEffect(() => {
    setMetric("app", "appVersion", APP_VERSION);
  }, []);
}

export function useRoomCoreAssetPreload() {
  const [allowCoreAssetPreload, setAllowCoreAssetPreload] = useState(false);
  useAssetPreloader(ROOM_CORE_ASSETS, { enabled: allowCoreAssetPreload });
  useEffect(() => {
    if (typeof navigator === "undefined") {
      setAllowCoreAssetPreload(true);
      return () => {};
    }
    const connection = (navigator as NavigatorWithConnection).connection ?? null;
    const slowTypes = new Set(["slow-2g", "2g", "3g"]);

    const evaluate = () => {
      if (!connection) {
        setAllowCoreAssetPreload(true);
        return;
      }
      if (connection.saveData === true) {
        setAllowCoreAssetPreload(false);
        return;
      }
      const effectiveType =
        typeof connection.effectiveType === "string"
          ? connection.effectiveType.toLowerCase()
          : "";
      if (slowTypes.has(effectiveType)) {
        setAllowCoreAssetPreload(false);
        return;
      }
      if (typeof connection.downlink === "number" && connection.downlink < 1.5) {
        setAllowCoreAssetPreload(false);
        return;
      }
      setAllowCoreAssetPreload(true);
    };

    evaluate();
    let unsubscribe: (() => void) | null = null;
    if (connection && typeof connection.addEventListener === "function") {
      connection.addEventListener("change", evaluate);
      unsubscribe = () => {
        connection.removeEventListener?.("change", evaluate);
      };
    }
    return () => {
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    setMetric("assets", "corePreloadEligible", allowCoreAssetPreload ? 1 : 0);
  }, [allowCoreAssetPreload]);
}

export function useRoomWarmup(soundManager: SoundManager | null) {
  useEffect(() => {
    if (typeof document === "undefined") return () => {};
    let disposed = false;
    const rafIds: number[] = [];
    let gsapModule: typeof import("gsap") | null = null;
    let pixiModule: typeof import("pixi.js") | null = null;
    let moduleLoadPromise: Promise<void> | null = null;
    let warmupIdleHandle: number | null = null;
    let warmupTimeoutHandle: number | null = null;
    let modulePrefetchCancel: (() => void) | null = null;

    const ensureModules = () => {
      if (moduleLoadPromise) {
        return moduleLoadPromise;
      }
      moduleLoadPromise = (async () => {
        if (!gsapModule) {
          try {
            gsapModule = await import("gsap");
          } catch {
            gsapModule = null;
          }
        }
        if (!pixiModule) {
          try {
            pixiModule = await import("pixi.js");
          } catch {
            pixiModule = null;
          }
        }
      })().catch(() => {
        moduleLoadPromise = null;
      });
      return moduleLoadPromise ?? Promise.resolve();
    };

    const scheduleModulePrefetch = () => {
      if (typeof window === "undefined") return;
      const win = window as Window &
        typeof globalThis & {
          requestIdleCallback?: (
            cb: IdleRequestCallback,
            options?: IdleRequestOptions
          ) => number;
          cancelIdleCallback?: (handle: number) => void;
        };
      if (typeof win.requestIdleCallback === "function") {
        const id = win.requestIdleCallback(
          () => {
            modulePrefetchCancel = null;
            void ensureModules();
          },
          { timeout: 1200 }
        );
        modulePrefetchCancel = () => win.cancelIdleCallback?.(id);
      } else {
        const timeoutId = window.setTimeout(() => {
          modulePrefetchCancel = null;
          void ensureModules();
        }, 400);
        modulePrefetchCancel = () => window.clearTimeout(timeoutId);
      }
    };
    scheduleModulePrefetch();

    const pumpFrames = (remaining: number) => {
      if (disposed || remaining <= 0) return;
      const id = requestAnimationFrame(() => {
        if (gsapModule) {
          gsapModule.gsap.ticker.tick();
        }
        if (pixiModule) {
          pixiModule.Ticker.shared.update();
        }
        pumpFrames(remaining - 1);
      });
      rafIds.push(id);
    };

    const runWarmup = async () => {
      if (document.visibilityState !== "visible") return;
      const warmupStartedAt =
        typeof performance !== "undefined" ? performance.now() : null;
      await ensureModules();
      if (disposed) return;
      let tickerRestore: (() => void) | null = null;
      if (soundManager) {
        void soundManager.warmup().catch(() => undefined);
      }
      if (gsapModule) {
        gsapModule.gsap.ticker.wake();
        gsapModule.gsap.ticker.tick();
      }
      try {
        if (pixiModule) {
          const ticker = pixiModule.Ticker.shared;
          const prevAutoStart = ticker.autoStart;
          const wasStarted = ticker.started ?? false;
          if (!wasStarted) {
            ticker.autoStart = true;
            ticker.start();
          }
          ticker.update();
          tickerRestore = () => {
            ticker.autoStart = prevAutoStart;
            if (!wasStarted && ticker.started) {
              ticker.stop();
            }
          };
        }
        pumpFrames(3);
      } finally {
        tickerRestore?.();
        if (warmupStartedAt !== null) {
          setMetric(
            "warmup",
            "roomWarmupMs",
            Math.round(performance.now() - warmupStartedAt)
          );
        }
      }
    };

    const cancelScheduledWarmup = () => {
      const win = window as Window &
        typeof globalThis & {
          cancelIdleCallback?: (handle: number) => void;
        };
      if (warmupIdleHandle !== null) {
        win.cancelIdleCallback?.(warmupIdleHandle);
        warmupIdleHandle = null;
      }
      if (warmupTimeoutHandle !== null) {
        window.clearTimeout(warmupTimeoutHandle);
        warmupTimeoutHandle = null;
      }
    };

    const scheduleWarmup = () => {
      cancelScheduledWarmup();
      const win = window as Window &
        typeof globalThis & {
          requestIdleCallback?: (
            cb: IdleRequestCallback,
            options?: IdleRequestOptions
          ) => number;
        };
      if (typeof win.requestIdleCallback === "function") {
        warmupIdleHandle = win.requestIdleCallback(
          () => {
            warmupIdleHandle = null;
            void runWarmup();
          },
          { timeout: 1200 }
        );
      } else {
        warmupTimeoutHandle = window.setTimeout(() => {
          warmupTimeoutHandle = null;
          void runWarmup();
        }, 300);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      cancelScheduledWarmup();
      void runWarmup();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange, {
      passive: true,
    });

    if (document.visibilityState === "visible") {
      scheduleWarmup();
    }

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      rafIds.forEach((id) => cancelAnimationFrame(id));
      cancelScheduledWarmup();
      modulePrefetchCancel?.();
    };
  }, [soundManager]);
}

export function useRoomComponentPrefetch() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let cancelled = false;
    const win = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          cb: IdleRequestCallback,
          options?: IdleRequestOptions
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    const runPrefetch = async () => {
      for (const loader of PREFETCH_COMPONENT_LOADERS) {
        if (cancelled) break;
        try {
          await loader();
        } catch {
          // ignore individual loader failure
        }
      }
    };

    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    let interactionBlocked = false;
    let interactionReleaseTimeout: number | null = null;

    const schedulePrefetch = (delay = 0) => {
      if (cancelled) return;
      if (idleHandle !== null) {
        win.cancelIdleCallback?.(idleHandle);
        idleHandle = null;
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (delay > 0) {
        timeoutHandle = window.setTimeout(() => {
          timeoutHandle = null;
          if (cancelled) return;
          triggerPrefetch();
        }, delay);
        return;
      }
      if (typeof win.requestIdleCallback === "function") {
        idleHandle = win.requestIdleCallback(triggerPrefetch, { timeout: 2000 });
      } else {
        timeoutHandle = window.setTimeout(triggerPrefetch, 800);
      }
    };

    const triggerPrefetch = () => {
      idleHandle = null;
      timeoutHandle = null;
      if (interactionBlocked) {
        schedulePrefetch(1200);
        return;
      }
      void runPrefetch();
    };

    const handleInteraction = () => {
      interactionBlocked = true;
      if (interactionReleaseTimeout !== null) {
        window.clearTimeout(interactionReleaseTimeout);
      }
      interactionReleaseTimeout = window.setTimeout(() => {
        interactionBlocked = false;
        schedulePrefetch(0);
      }, 1600);
    };

    window.addEventListener("pointerdown", handleInteraction, { passive: true });
    window.addEventListener("touchstart", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction, { passive: true });

    schedulePrefetch(0);

    return () => {
      cancelled = true;
      if (idleHandle !== null) {
        win.cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
      if (interactionReleaseTimeout !== null) {
        window.clearTimeout(interactionReleaseTimeout);
      }
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);
}

export function useRoomWaitingServiceWorkerResync() {
  useEffect(() => {
    void resyncWaitingServiceWorker("room:mount");
    if (typeof document === "undefined") {
      return undefined;
    }
    const handleVisibilityResync = () => {
      if (document.visibilityState === "visible") {
        void resyncWaitingServiceWorker("room:visible");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityResync, true);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityResync, true);
    };
  }, []);
}

