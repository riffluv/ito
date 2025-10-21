"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SoundManager } from "./SoundManager";
import { SOUND_LIBRARY } from "./registry";
import { DEFAULT_SOUND_SETTINGS, SoundId, SoundSettings } from "./types";
import { setGlobalSoundManager } from "./global";

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
  "reset_game",
]);

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

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    if (PREWARM_SOUND_IDS.length === 0) return;

    const critical = PREWARM_SOUND_IDS.filter((id) => CRITICAL_PREWARM_IDS.has(id));
    const deferred = PREWARM_SOUND_IDS.filter((id) => !CRITICAL_PREWARM_IDS.has(id));
    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    if (critical.length) {
      manager.prewarm(critical).catch(() => undefined);
    }

    if (deferred.length) {
      const runDeferred = () => {
        if (cancelled) return;
        manager.prewarm(deferred).catch(() => undefined);
      };
      const win = window as Window &
        typeof globalThis & {
          requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
          cancelIdleCallback?: (handle: number) => void;
        };
      if (typeof win.requestIdleCallback === "function") {
        idleHandle = win.requestIdleCallback(runDeferred, { timeout: 3000 });
      } else {
        timeoutHandle = window.setTimeout(runDeferred, 1200);
      }
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
