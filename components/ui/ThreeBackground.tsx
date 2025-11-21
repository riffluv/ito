"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { logError, logInfo, logWarn } from "@/lib/utils/log";
import { setMetric } from "@/lib/utils/metrics";
import {
  pixiBackgroundHost,
  type SetSceneResult,
} from "@/lib/pixi/backgroundHost";
import { type PixiBackgroundProfile } from "@/lib/pixi/backgroundTypes";

type BackgroundType = "css" | "pixi-simple" | "pixi-dq" | "pixi-inferno";
type BackgroundQuality = "low" | "med" | "high";

const normalizeBackgroundType = (value: string | null): BackgroundType => {
  if (value === "pixi-simple" || value === "pixi-lite") {
    return "pixi-simple";
  }
  if (value === "pixi-dq" || value === "pixi" || value === "pixijs") {
    return "pixi-dq";
  }
  if (value === "pixi-inferno" || value === "inferno") {
    return "pixi-inferno";
  }
  return "css";
};

const logPixiBackground = (
  level: "info" | "warn" | "error",
  event: string,
  data?: unknown
) => {
  const logger =
    level === "warn" ? logWarn : level === "error" ? logError : logInfo;
  logger("three-background-pixi", event, data);
};

declare global {
  interface Window {
    bg?: {
      lightSweep: () => void;
      launchFireworks: () => void;
      launchVolcanoEruption?: () => void;
      launchMeteors: () => void;
      flashRed?: (count?: number, duration?: number) => void;
      setQuality: (quality: BackgroundQuality) => void;
      getQuality: () => BackgroundQuality;
      getRenderer: () => "dom" | "pixi";
      updatePointerGlow: (active: boolean) => void;
    };
  }
}

const ensureGlobalBackground = () => {
  if (typeof window === "undefined") return;
  if (!window.bg) {
    window.bg = {
      lightSweep: () => {},
      launchFireworks: () => {},
      launchMeteors: () => {},
      setQuality: () => {},
      getQuality: () => "low",
      getRenderer: () => "dom",
      updatePointerGlow: () => {},
    };
  }
};

const updateGlobalBackground = (payload: {
  renderer: "dom" | "pixi";
  quality: BackgroundQuality;
  onLightSweep?: () => void;
  onLaunchFireworks?: () => void;
  onLaunchMeteors?: () => void;
  onLaunchVolcanoEruption?: () => void;
  onFlashRed?: (count?: number, duration?: number) => void;
  onSetQuality?: (quality: BackgroundQuality) => void;
  onPointerGlow?: (active: boolean) => void;
}) => {
  if (typeof window === "undefined") return;
  ensureGlobalBackground();
  const noop = () => {};
  const noopGlow = () => {};
  window.bg = {
    lightSweep: payload.onLightSweep ?? noop,
    launchFireworks: payload.onLaunchFireworks ?? noop,
    launchMeteors: payload.onLaunchMeteors ?? noop,
    launchVolcanoEruption: payload.onLaunchVolcanoEruption ?? noop,
    flashRed: payload.onFlashRed ?? noop,
    setQuality: payload.onSetQuality ?? noop,
    getQuality: () => payload.quality,
    getRenderer: () => payload.renderer,
    updatePointerGlow: payload.onPointerGlow ?? noopGlow,
  };
};

export interface ThreeBackgroundProps {
  className?: string;
}

export function ThreeBackground({ className }: ThreeBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { supports3D, gpuCapability, softwareRenderer } = useAnimationSettings();
  const performanceProfile: PixiBackgroundProfile =
    softwareRenderer || gpuCapability === "low" ? "software" : "default";
  // Software renderer (failIfMajorPerformanceCaveat / SwiftShader etc.) tends to fail WebGL init
  // and show a blank/black screen, so bail out to the CSS background immediately.
  const shouldForceCssFallback = !supports3D || softwareRenderer;

  const [backgroundType, setBackgroundType] =
    useState<BackgroundType>("pixi-dq");
  const [sceneNonce, setSceneNonce] = useState(0);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const retryRef = useRef(0);

  const recordBackgroundMetric = useCallback((key: string, value: number | string) => {
    try {
      setMetric("background", key, value);
    } catch {
      // ignore metrics failures in dev
    }
  }, []);

  useEffect(() => {
    ensureGlobalBackground();
  }, []);

  useEffect(() => {
    pixiBackgroundHost.setPerformanceProfile(performanceProfile);
  }, [performanceProfile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.setItem("backgroundType", backgroundType);
    } catch {
      // noop
    }
  }, [backgroundType]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("backgroundType");
      if (saved) {
        setBackgroundType(normalizeBackgroundType(saved));
      } else {
        localStorage.setItem("backgroundType", "pixi-dq");
        setBackgroundType("pixi-dq");
      }
    } catch {
      // noop
    }
    const handleBackgroundChange = (event: Event) => {
      if (event instanceof CustomEvent) {
        setBackgroundType(
          normalizeBackgroundType(event.detail?.backgroundType ?? null)
        );
      }
    };
    window.addEventListener(
      "backgroundTypeChanged",
      handleBackgroundChange as EventListener
    );
    return () => {
      window.removeEventListener(
        "backgroundTypeChanged",
        handleBackgroundChange as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    pixiBackgroundHost.attachCanvas(el ?? null);
    return () => {
      pixiBackgroundHost.detachCanvas(el ?? null);
      pixiBackgroundHost.dispose();
    };
  }, []);

  // WebGL コンテキストロスト時にシーンを再適用
  useEffect(() => {
    const handleLost = () => setSceneNonce((value) => value + 1);
    const handleRestored = () => setSceneNonce((value) => value + 1);
    if (typeof window !== "undefined") {
      window.addEventListener("pixiBackgroundContextLost", handleLost);
      window.addEventListener("pixiBackgroundContextRestored", handleRestored);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pixiBackgroundContextLost", handleLost);
        window.removeEventListener("pixiBackgroundContextRestored", handleRestored);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && backgroundType !== "css") {
        setSceneNonce((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [backgroundType]);

  const effectiveQuality = useMemo<BackgroundQuality>(() => {
    if (backgroundType === "pixi-dq" || backgroundType === "pixi-inferno") {
      return "high";
    }
    if (backgroundType === "pixi-simple") {
      return "low";
    }
    return "low";
  }, [backgroundType]);

  const applySceneResult = useCallback(
    (result: SetSceneResult) => {
      if (result.renderer === "pixi") {
        updateGlobalBackground({
          renderer: "pixi",
          quality: result.quality,
          onLightSweep: result.effects?.lightSweep,
          onLaunchFireworks: result.effects?.launchFireworks,
          onLaunchMeteors: result.effects?.launchMeteors,
          onLaunchVolcanoEruption: result.effects?.launchVolcanoEruption,
          onFlashRed: result.effects?.flashRed,
          onSetQuality: result.effects?.setQuality,
          onPointerGlow: result.effects?.updatePointerGlow,
        });
      } else {
        updateGlobalBackground({
          renderer: "dom",
          quality: result.quality,
        });
      }
    },
    []
  );

  const applyBackgroundScene = useCallback(async () => {
    const currentType = backgroundType;
    setBackgroundReady(false);

    if (currentType === "css" || shouldForceCssFallback) {
      if (currentType !== "css") {
        setBackgroundType("css");
      }
      pixiBackgroundHost.setCanvasVisible(false);
      applySceneResult({ renderer: "dom", quality: effectiveQuality });
      retryRef.current = 0;
      setBackgroundReady(true);
      return;
    }

    try {
      const pixiKey = currentType as Exclude<BackgroundType, "css">;
      const initStart = performance.now();
      pixiBackgroundHost.setCanvasVisible(true);
      const result = await pixiBackgroundHost.setScene({
        key: pixiKey,
        quality: effectiveQuality,
        profile: performanceProfile,
        onMetrics: (metrics) => logPixiBackground("info", "simple-metrics", metrics),
      });
      applySceneResult(result);
      const initDuration = performance.now() - initStart;
      recordBackgroundMetric("lastInitMs", Number(initDuration.toFixed(2)));
      recordBackgroundMetric("lastProfile", performanceProfile);
      recordBackgroundMetric("lastScene", pixiKey);
      recordBackgroundMetric("lastRenderer", result.renderer);
      recordBackgroundMetric("lastQuality", result.quality);
      logPixiBackground("info", "scene-ready", {
        key: pixiKey,
        profile: performanceProfile,
        renderer: result.renderer,
        quality: result.quality,
        durationMs: initDuration,
        gpuCapability,
        softwareRenderer,
      });
      retryRef.current = 0;
      setBackgroundReady(true);
    } catch (error) {
      logPixiBackground("error", "scene-init-failed", error);
      setBackgroundReady(false);
      if (retryRef.current < 1) {
        retryRef.current += 1;
        setTimeout(() => setSceneNonce((value) => value + 1), 1200);
      } else {
        setBackgroundType("css");
      }
    }
  }, [
    applySceneResult,
    backgroundType,
    effectiveQuality,
    gpuCapability,
    performanceProfile,
    recordBackgroundMetric,
    shouldForceCssFallback,
    softwareRenderer,
  ]);

  useEffect(() => {
    applyBackgroundScene();
  }, [applyBackgroundScene, sceneNonce]);

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <div
        ref={mountRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          transition: "opacity 240ms ease",
          background:
            "radial-gradient(circle at 25% 25%, rgba(34,44,84,0.45), transparent 60%), linear-gradient(180deg, #05060a 0%, #080a12 60%, #05060a 100%)",
          opacity: backgroundType === "css" || !backgroundReady ? 1 : 0,
        }}
      />
    </div>
  );
}
