"use client";

import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import {
  pixiBackgroundHost,
  type SetSceneResult,
} from "@/lib/pixi/backgroundHost";
import {
  BACKGROUND_EVENT_NAME,
  bootstrapBackgroundTheme,
  DEFAULT_BACKGROUND_THEME,
  normalizeBackgroundTheme,
  persistBackgroundTheme,
  resolveEffectiveBackground,
  type BackgroundTheme,
} from "@/lib/pixi/backgroundPreference";
import { type PixiBackgroundProfile } from "@/lib/pixi/backgroundTypes";
import { logError, logInfo, logWarn } from "@/lib/utils/log";
import { setMetric } from "@/lib/utils/metrics";
import { useCallback, useEffect, useRef, useState } from "react";

type BackgroundQuality = "low" | "med" | "high";

const logPixiBackground = (
  level: "info" | "warn" | "error",
  event: string,
  data?: unknown
) => {
  const logger =
    level === "warn" ? logWarn : level === "error" ? logError : logInfo;
  logger("pixi-background", event, data);
};

declare global {
  interface Window {
    bg?: {
      lightSweep: () => void;
      launchFireworks: () => void;
      launchVolcanoEruption?: () => void;
      launchMeteors: () => void;
      flashRed?: (count?: number, duration?: number) => void;
      flashWhite?: (duration?: number) => void;
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
      flashWhite: () => {},
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
  onFlashWhite?: (duration?: number) => void;
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
    flashWhite: payload.onFlashWhite ?? noop,
    setQuality: payload.onSetQuality ?? noop,
    getQuality: () => payload.quality,
    getRenderer: () => payload.renderer,
    updatePointerGlow: payload.onPointerGlow ?? noopGlow,
  };
};

export interface PixiBackgroundProps {
  className?: string;
}

const getQualityForBackground = (id: BackgroundTheme): BackgroundQuality => {
  if (id === "pixi-dq" || id === "pixi-inferno") {
    return "high";
  }
  if (id === "pixi-simple") {
    return "low";
  }
  return "low";
};

export function PixiBackground({ className }: PixiBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { supports3D, gpuCapability, softwareRenderer } =
    useAnimationSettings();
  const performanceProfile: PixiBackgroundProfile =
    softwareRenderer || gpuCapability === "low" ? "software" : "default";
  const shouldForceCssFallback = !supports3D || softwareRenderer;

  const [backgroundType, setBackgroundType] = useState<BackgroundTheme>(
    typeof window !== "undefined"
      ? bootstrapBackgroundTheme()
      : DEFAULT_BACKGROUND_THEME
  );
  const [sceneNonce, setSceneNonce] = useState(0);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<{
    reason: string;
    retryAt: number;
  } | null>(null);
  const retryRef = useRef(0);
  const suppressPersistCssRef = useRef(false);
  const fallbackPreviousTypeRef = useRef<BackgroundTheme | null>(null);
  const fallbackRestoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const recordBackgroundMetric = useCallback(
    (key: string, value: number | string) => {
      try {
        setMetric("background", key, value);
      } catch {
        // ignore metrics failures in dev
      }
    },
    []
  );

  useEffect(() => {
    ensureGlobalBackground();
  }, []);

  useEffect(() => {
    pixiBackgroundHost.setPerformanceProfile(performanceProfile);
  }, [performanceProfile]);

  useEffect(() => {
    return () => {
      if (fallbackRestoreTimerRef.current) {
        clearTimeout(fallbackRestoreTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (backgroundType === "css" && suppressPersistCssRef.current) {
        return;
      }
      persistBackgroundTheme(backgroundType, { emit: false });
      suppressPersistCssRef.current = false;
    } catch {
      // noop
    }
  }, [backgroundType]);

  useEffect(() => {
    const saved = bootstrapBackgroundTheme();
    // Recover from previously persisted forced CSS fallback on devices that
    // can render Pixi again. We rarely have a user-facing toggle to choose
    // CSS explicitly, so prefer Pixi here.
    setBackgroundType(saved === "css" ? DEFAULT_BACKGROUND_THEME : saved);

    const handleBackgroundChange = (event: Event) => {
      if (event instanceof CustomEvent) {
        setBackgroundType(
          normalizeBackgroundTheme(event.detail?.backgroundType ?? null)
        );
      }
    };
    window.addEventListener(
      BACKGROUND_EVENT_NAME,
      handleBackgroundChange as EventListener
    );
    return () => {
      window.removeEventListener(
        BACKGROUND_EVENT_NAME,
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
        window.removeEventListener(
          "pixiBackgroundContextRestored",
          handleRestored
        );
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

  const applySceneResult = useCallback((result: SetSceneResult) => {
    if (result.renderer === "pixi") {
      updateGlobalBackground({
        renderer: "pixi",
        quality: result.quality,
        onLightSweep: result.effects?.lightSweep,
        onLaunchFireworks: result.effects?.launchFireworks,
        onLaunchMeteors: result.effects?.launchMeteors,
        onLaunchVolcanoEruption: result.effects?.launchVolcanoEruption,
        onFlashRed: result.effects?.flashRed,
        onFlashWhite: result.effects?.flashWhite,
        onSetQuality: result.effects?.setQuality,
        onPointerGlow: result.effects?.updatePointerGlow,
      });
    } else {
      updateGlobalBackground({
        renderer: "dom",
        quality: result.quality,
      });
    }
  }, []);

  const applyBackgroundScene = useCallback(async () => {
    const capability = {
      supportsPixi: !shouldForceCssFallback,
      allowHighQuality: gpuCapability !== "low" && !softwareRenderer,
    };
    const currentType = resolveEffectiveBackground({
      hostTheme: undefined,
      localTheme: backgroundType,
      capability,
    });
    const effectiveQuality = getQualityForBackground(currentType);
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
      const pixiKey = currentType as Exclude<BackgroundTheme, "css">;
      const initStart = performance.now();
      pixiBackgroundHost.setCanvasVisible(true);
      const result = await pixiBackgroundHost.setScene({
        key: pixiKey,
        quality: effectiveQuality,
        profile: performanceProfile,
        onMetrics: (metrics) =>
          logPixiBackground("info", "simple-metrics", metrics),
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
      setFallbackNotice(null);
      setBackgroundReady(true);
    } catch (error) {
      logPixiBackground("error", "scene-init-failed", error);
      setBackgroundReady(false);
      retryRef.current += 1;
      const failureCount = retryRef.current;
      const backoffMs = Math.min(45000, 4000 * failureCount);
      if (failureCount <= 2) {
        setTimeout(() => setSceneNonce((value) => value + 1), backoffMs);
      } else {
        if (!fallbackPreviousTypeRef.current) {
          fallbackPreviousTypeRef.current = currentType;
        }
        suppressPersistCssRef.current = true;
        setBackgroundType("css");
        setFallbackNotice({
          reason: "render-failed",
          retryAt: Date.now() + backoffMs,
        });
        if (!fallbackRestoreTimerRef.current) {
          fallbackRestoreTimerRef.current = setTimeout(() => {
            const prev = fallbackPreviousTypeRef.current;
            fallbackPreviousTypeRef.current = null;
            fallbackRestoreTimerRef.current = null;
            if (prev) {
              setBackgroundType(prev);
              setSceneNonce((value) => value + 1);
            }
          }, backoffMs);
        }
      }
    }
  }, [
    applySceneResult,
    backgroundType,
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
      {fallbackNotice && (
        <div
          style={{
            position: "fixed",
            left: 12,
            bottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background:
              "linear-gradient(135deg, rgba(15,18,30,0.92), rgba(6,8,13,0.92))",
            color: "#e6e9f5",
            fontSize: 13,
            lineHeight: 1.5,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            pointerEvents: "auto",
            border: "1px solid rgba(255,255,255,0.12)",
            maxWidth: 280,
            zIndex: 20,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            背景描画を一時停止しました
          </div>
          <div style={{ opacity: 0.8, marginBottom: 8 }}>
            端末負荷か描画エラーを検知しました。再試行してもよい場合は下のボタンを押してください。
          </div>
          <button
            type="button"
            onClick={() => {
              setFallbackNotice(null);
              const prev = fallbackPreviousTypeRef.current;
              if (prev) {
                setBackgroundType(prev);
              } else {
                setBackgroundType("pixi-dq");
              }
              setSceneNonce((value) => value + 1);
            }}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              background:
                "linear-gradient(90deg, #3e5bff 0%, #5bc0ff 100%)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
            }}
          >
            再試行する
          </button>
        </div>
      )}
    </div>
  );
}

export default PixiBackground;
