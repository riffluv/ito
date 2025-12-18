"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSoundManager, useSoundSettings } from "./SoundProvider";

type RouteBgmControllerProps = {
  enabled: boolean;
};

const isDocumentVisible = () =>
  typeof document === "undefined" ? true : document.visibilityState === "visible";

export function RouteBgmController({ enabled }: RouteBgmControllerProps) {
  const soundManager = useSoundManager();
  const soundSettings = useSoundSettings();
  const bgmPlayingRef = useRef(false);

  const [visible, setVisible] = useState(isDocumentVisible);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const handleVisibility = () => {
      setVisible(document.visibilityState === "visible");
    };
    const handlePageHide = () => {
      setVisible(false);
    };
    const handlePageShow = () => {
      setVisible(isDocumentVisible());
    };

    document.addEventListener("visibilitychange", handleVisibility, { passive: true });
    window.addEventListener("pagehide", handlePageHide, { passive: true });
    window.addEventListener("pageshow", handlePageShow, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const shouldPlayBgm = useMemo(() => {
    if (!soundManager) return false;
    if (!enabled) return false;
    if (!visible) return false;
    if (soundSettings.muted) return false;
    return (soundSettings.categoryVolume?.ambient ?? 0) > 0.001;
  }, [enabled, soundManager, soundSettings.categoryVolume?.ambient, soundSettings.muted, visible]);

  useEffect(() => {
    if (!soundManager) {
      bgmPlayingRef.current = false;
      return undefined;
    }

    if (shouldPlayBgm) {
      bgmPlayingRef.current = true;
      void soundManager.play("bgm1").catch(() => {
        bgmPlayingRef.current = false;
      });
    } else if (bgmPlayingRef.current) {
      soundManager.cancelPending("bgm1");
      soundManager.stop("bgm1");
      bgmPlayingRef.current = false;
    } else {
      soundManager.cancelPending("bgm1");
    }

    return () => {
      if (bgmPlayingRef.current) {
        soundManager.cancelPending("bgm1");
        soundManager.stop("bgm1");
        bgmPlayingRef.current = false;
      }
    };
  }, [soundManager, shouldPlayBgm]);

  return null;
}
