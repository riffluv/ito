"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SoundManager } from "./SoundManager";
import { SOUND_LIBRARY } from "./registry";
import { DEFAULT_SOUND_SETTINGS, SoundSettings } from "./types";
import { setGlobalSoundManager } from "./global";

interface SoundContextValue {
  manager: SoundManager | null;
  settings: SoundSettings;
}

const context = createContext<SoundContextValue>({
  manager: null,
  settings: DEFAULT_SOUND_SETTINGS,
});

const PREWARM_SOUND_IDS = SOUND_LIBRARY.filter((sound) => sound.preload?.decode).map((sound) => sound.id);

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
    manager.prewarm(PREWARM_SOUND_IDS).catch(() => undefined);
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
