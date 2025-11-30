"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SoundManager } from "./SoundManager";
import { SOUND_LIBRARY } from "./registry";
import { DEFAULT_SOUND_SETTINGS, SoundId, SoundSettings } from "./types";
import { markSoundReady, resetSoundReady, setGlobalSoundManager } from "./global";
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
  "drop_success",
  "clue_decide",
  "order_confirm",
]);
const PRIORITY_STAGE_ONE: SoundId[] = ["card_deal", "clue_decide", "drop_success"];
const HEAVY_PREWARM_IDS = new Set<SoundId>([
  "clear_success1",
  "clear_success2",
  "clear_failure",
  "result_victory",
  "result_failure",
  "ledger_close",
  "bgm1",
]);
const HEAVY_PREWARM_ENABLED = (() => {
  if (typeof process === "undefined") return false;
  const raw = (process.env.NEXT_PUBLIC_AUDIO_PREWARM_HEAVY || "").toString().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true";
})();
const CONSTRAINED_PREWARM_IDS = new Set<SoundId>([
  "ui_click",
  "card_flip",
  "card_place",
  "drop_success",
]);
const RESULT_PREWARM_IDS: SoundId[] = ["clear_success1", "clear_success2", "clear_failure"];
const RESUME_ON_POINTER = process.env.NEXT_PUBLIC_AUDIO_RESUME_ON_POINTER === "1";

type NetworkInformationLike = {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
};

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
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      unsubscribe?.();
      if (!manager) return;
      setGlobalSoundManager(null);
      manager.destroy();
      if (managerRef.current === manager) {
        managerRef.current = null;
      }
    };

    if (!manager) return cleanup;

    setGlobalSoundManager(manager);

    unsubscribe = manager.subscribe((event) => {
      if (event.type === "settings") {
        setSettings(event.settings);
      }
    });

    return cleanup;
  }, []);

  // Audio ready gate: warmup + result fanfare pre-decode, then publish readiness
  useEffect(() => {
    const manager = managerRef.current;
    let cancelled = false;
    const clearReadyFlag = () => {
      if (typeof window !== "undefined") {
        delete (window as typeof window & { __AUDIO_READY__?: boolean }).__AUDIO_READY__;
      }
      resetSoundReady();
    };

    clearReadyFlag();

    if (!manager) {
      return clearReadyFlag;
    }

    const prepare = async () => {
      try {
        await manager.warmup();
        await manager.prewarm(RESULT_PREWARM_IDS);
      } catch (error) {
        traceError("sound.ready.prepare", error);
      }
      if (cancelled) return;
      if (typeof window !== "undefined") {
        (window as typeof window & { __AUDIO_READY__?: boolean }).__AUDIO_READY__ = true;
      }
      markSoundReady(manager);
    };

    void prepare();

    return () => {
      cancelled = true;
      clearReadyFlag();
    };
  }, []);

  // 軽量ウォームアップ（フラグON時のみ、初回入力/可視化で一度だけ）
  useEffect(() => {
    const mgr = managerRef.current;
    const didWarmRef = { current: false };

    const candidates = ["card_flip", "ui_click"] as SoundId[];
    const prewarmIds: SoundId[] = candidates.filter((id) =>
      (PREWARM_SOUND_IDS as ReadonlyArray<SoundId>).includes(id)
    );

    const runWarmup = async () => {
      if (didWarmRef.current || !mgr) return;
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
        traceError("warmup.audio", error);
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
      if (typeof window === "undefined" || typeof document === "undefined") return;
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };

    if (process.env.NEXT_PUBLIC_PERF_WARMUP !== "1" || !mgr) {
      return detach;
    }

    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
      document.addEventListener("visibilitychange", onVisibility, { passive: true });
    }
    return detach;
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    let cancelled = false;
    const pendingTimeouts = new Set<number>();

    const cleanup = () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        pendingTimeouts.forEach((handle) => window.clearTimeout(handle));
      }
      pendingTimeouts.clear();
    };

    if (!manager) return cleanup;
    if (PREWARM_SOUND_IDS.length === 0) return cleanup;

    const connection =
      typeof navigator !== "undefined"
        ? ((navigator as NavigatorWithConnection).connection ?? null)
        : null;
    const effectiveType =
      typeof connection?.effectiveType === "string"
        ? String(connection.effectiveType).toLowerCase()
        : "";
    const constrainedNetwork =
      !!connection &&
      (connection.saveData === true || ["slow-2g", "2g", "3g"].includes(effectiveType));
    setMetric("audio", "prewarm.constrained", constrainedNetwork ? 1 : 0);

    const criticalSet = constrainedNetwork ? CONSTRAINED_PREWARM_IDS : CRITICAL_PREWARM_IDS;
    const critical = PREWARM_SOUND_IDS.filter((id) => criticalSet.has(id));
    const deferredBase = PREWARM_SOUND_IDS.filter((id) => !criticalSet.has(id));
    const stageOne: SoundId[] = [];
    const stageTwo: SoundId[] = [];
    const heavyStage: SoundId[] = [];
    if (!constrainedNetwork) {
      deferredBase.forEach((id) => {
        if (PRIORITY_STAGE_ONE.includes(id)) {
          stageOne.push(id);
          return;
        }
        if (HEAVY_PREWARM_IDS.has(id)) {
          heavyStage.push(id);
          return;
        }
        stageTwo.push(id);
      });
    }

    const recordSoundMetric = (soundId: SoundId, startedAt: number | null) => {
      if (startedAt !== null) {
        setMetric(
          "audio",
          `prewarm.sound.${soundId}`,
          Math.max(0, Math.round(performance.now() - startedAt))
        );
      }
    };

    const delay = async (ms: number) => {
      if (cancelled || typeof window === "undefined") return;
      if (ms <= 0) return;
      await new Promise<void>((resolve) => {
        const handle = window.setTimeout(() => {
          pendingTimeouts.delete(handle);
          resolve();
        }, ms);
        pendingTimeouts.add(handle);
      });
    };

    const processQueue = async (
      queue: SoundId[],
      metricsKey: string,
      options: { initialDelay?: number; gapLong: number; gapShort: number; traceKey: string }
    ) => {
      if (queue.length === 0 || cancelled) return;
      const totalStartedAt =
        typeof performance !== "undefined" ? performance.now() : null;
      if (options.initialDelay && options.initialDelay > 0) {
        await delay(options.initialDelay);
        if (cancelled) return;
      }
      for (let index = 0; index < queue.length; index += 1) {
        const soundId = queue[index];
        const soundStartedAt =
          typeof performance !== "undefined" ? performance.now() : null;
        try {
          await manager.prewarm([soundId]);
        } catch (error) {
          traceError(options.traceKey, error, { soundId });
        } finally {
          recordSoundMetric(soundId, soundStartedAt);
        }
        if (cancelled) break;
        if (index < queue.length - 1) {
          const remaining = queue.length - index - 1;
          const gap =
            remaining > 2 ? options.gapLong : options.gapShort;
          await delay(gap);
          if (cancelled) break;
        }
      }
      if (totalStartedAt !== null) {
        setMetric(
          "audio",
          metricsKey,
          Math.round(Math.max(0, (performance?.now?.() ?? totalStartedAt) - totalStartedAt))
        );
      }
    };

    void (async () => {
      if (critical.length) {
        const startedAt =
          typeof performance !== "undefined" ? performance.now() : null;
        try {
          for (const soundId of critical) {
            if (cancelled) break;
            const soundStartedAt =
              typeof performance !== "undefined" ? performance.now() : null;
            try {
              await manager.prewarm([soundId]);
            } catch (soundError) {
              traceError("audio.prewarm.critical", soundError, { soundId });
            } finally {
              recordSoundMetric(soundId, soundStartedAt);
            }
            if (cancelled) break;
          }
          if (startedAt !== null) {
            setMetric(
              "audio",
              "prewarm.criticalMs",
              Math.round(Math.max(0, (performance?.now?.() ?? startedAt) - startedAt))
            );
          }
        } catch (error) {
          setMetric("audio", "prewarm.criticalMs", -1);
          traceError("audio.prewarm.critical.batch", error);
        }
      } else {
        setMetric("audio", "prewarm.criticalMs", 0);
      }

      await processQueue(stageOne, "prewarm.stageOneMs", {
        gapLong: 120,
        gapShort: 70,
        traceKey: "audio.prewarm.stageOne",
      });
      await processQueue(stageTwo, "prewarm.deferredMs", {
        initialDelay: 240,
        gapLong: 260,
        gapShort: 140,
        traceKey: "audio.prewarm.deferred",
      });
      if (heavyStage.length && HEAVY_PREWARM_ENABLED) {
        await processQueue(heavyStage, "prewarm.heavyMs", {
          initialDelay: 1400,
          gapLong: 520,
          gapShort: 260,
          traceKey: "audio.prewarm.heavy",
        });
      } else if (heavyStage.length) {
        // 重い音源はオンデマンド再生に任せる（初回再生がわずかに遅れる可能性あり）
        setMetric("audio", "prewarm.heavyMs", -1);
        traceAction("audio.prewarm.heavy.skipped", {
          reason: "env_disabled",
        });
      }
    })();

    if (critical.length === 0) {
      setMetric("audio", "prewarm.criticalMs", 0);
    }

    return cleanup;
  }, []);

  useEffect(() => {
    const manager = managerRef.current;

    const markInteraction = () => {
      if (!manager) return;
      manager.markUserInteraction();
      if (RESUME_ON_POINTER) {
        void manager.prepareForInteraction();
      }
    };
    const detach = () => {
      if (typeof window === "undefined") return;
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
    };

    if (!manager || typeof window === "undefined") {
      return detach;
    }

    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction, { passive: true });
    return detach;
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
