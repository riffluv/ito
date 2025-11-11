"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type * as PIXITypes from "pixi.js";
import type {
  BackgroundQuality as SimpleBackgroundQuality,
  SimpleBackgroundController,
} from "@/lib/pixi/simpleBackground";
import type { DragonQuestBackgroundController } from "@/lib/pixi/dragonQuestBackground";
import type { InfernoBackgroundController } from "@/lib/pixi/infernoBackground";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { logError, logInfo, logWarn } from "@/lib/utils/log";

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
  const simpleControllerRef = useRef<SimpleBackgroundController | null>(null);
  const dragonQuestControllerRef =
    useRef<DragonQuestBackgroundController | null>(null);
  const infernoControllerRef =
    useRef<InfernoBackgroundController | null>(null);
  const legacyFrameIdRef = useRef<number>();
  const legacyAppRef = useRef<PIXITypes.Application | null>(null);
  const { reducedMotion, effectiveMode, supports3D, gpuCapability } =
    useAnimationSettings();

  const isLowPowerDevice =
    reducedMotion || gpuCapability === "low";

  const [backgroundType, setBackgroundType] =
    useState<BackgroundType>("pixi-dq");

  useEffect(() => {
    ensureGlobalBackground();
  }, []);

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

  const effectiveQuality = useMemo<BackgroundQuality>(() => {
    if (backgroundType === "pixi-dq" || backgroundType === "pixi-inferno") {
      return "high";
    }
    if (backgroundType === "pixi-simple") {
      return "low";
    }
    return "low";
  }, [backgroundType]);

  const cleanupSimpleBackground = () => {
    if (simpleControllerRef.current) {
      try {
        simpleControllerRef.current.destroy();
      } catch (error) {
        logPixiBackground("warn", "simple-destroy-error", error);
      }
      simpleControllerRef.current = null;
    }
    if (mountRef.current) {
      mountRef.current.innerHTML = "";
    }
  };

  const cleanupDragonQuestBackground = () => {
    if (dragonQuestControllerRef.current) {
      try {
        dragonQuestControllerRef.current.destroy();
      } catch (error) {
        logPixiBackground("warn", "dragon-quest-destroy-error", error);
      }
      dragonQuestControllerRef.current = null;
    }
    if (mountRef.current) {
      mountRef.current.innerHTML = "";
    }
  };

  const cleanupInfernoBackground = () => {
    if (infernoControllerRef.current) {
      try {
        infernoControllerRef.current.destroy();
      } catch (error) {
        logPixiBackground("warn", "inferno-destroy-error", error);
      }
      infernoControllerRef.current = null;
    }
    if (mountRef.current) {
      mountRef.current.innerHTML = "";
    }
  };

  const cleanupLegacyBackground = () => {
    const frameId = legacyFrameIdRef.current;
    if (frameId) {
      cancelAnimationFrame(frameId);
      legacyFrameIdRef.current = undefined;
    }
    const app = legacyAppRef.current;
    if (app) {
      try {
        app.stage.removeChildren();
        app.destroy(true);
      } catch (error) {
        logPixiBackground("warn", "legacy-destroy-error", error);
      }
      legacyAppRef.current = null;
    }
    if (mountRef.current) {
      mountRef.current.innerHTML = "";
    }
  };

  useEffect(() => {
    if (backgroundType !== "pixi-simple") {
      cleanupSimpleBackground();
      cleanupDragonQuestBackground();
      cleanupInfernoBackground();
      if (backgroundType !== "pixi-dq" && backgroundType !== "pixi-inferno") {
        updateGlobalBackground({
          renderer: "dom",
          quality: effectiveQuality,
        });
      }
      return undefined;
    }

    if (isLowPowerDevice || !supports3D) {
      logPixiBackground("warn", "simple-fallback-low-power", {
        reducedMotion,
        supports3D,
        gpuCapability,
        effectiveMode,
      });
      cleanupSimpleBackground();
      setBackgroundType("css");
      return undefined;
    }

    let disposed = false;
    let detachResize: (() => void) | null = null;

    const init = async () => {
      try {
        const module = await import("@/lib/pixi/simpleBackground");
        if (disposed) return;
        const controller = await module.createSimpleBackground({
          width: window.innerWidth,
          height: window.innerHeight,
          quality: effectiveQuality as SimpleBackgroundQuality,
          backgroundColor: 0x0a0a0a,
          dprCap: 2,
          onMetrics: (metrics) => {
            logPixiBackground("info", "simple-metrics", metrics);
          },
        });

        if (!mountRef.current) {
          controller.destroy();
          return;
        }

        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(controller.canvas);
        simpleControllerRef.current = controller;
        logPixiBackground("info", "simple-init-success");

        const handleResize = () => {
          controller.resize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);
        detachResize = () =>
          window.removeEventListener("resize", handleResize);

        updateGlobalBackground({
          renderer: "pixi",
          quality: effectiveQuality,
          onLightSweep: () => controller.lightSweep(),
          onPointerGlow: (active) => controller.updatePointerGlow(active),
        });
      } catch (error) {
        logPixiBackground("error", "simple-init-failed", error);
        if (!disposed) {
          cleanupSimpleBackground();
          setBackgroundType("css");
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (detachResize) {
        detachResize();
      }
      if (simpleControllerRef.current) {
        try {
          simpleControllerRef.current.destroy();
        } catch (error) {
          logPixiBackground("warn", "simple-cleanup-error", error);
        }
        simpleControllerRef.current = null;
      }
      updateGlobalBackground({
        renderer: "dom",
        quality: effectiveQuality,
      });
    };
  }, [
    backgroundType,
    effectiveMode,
    effectiveQuality,
    gpuCapability,
    isLowPowerDevice,
    reducedMotion,
    supports3D,
  ]);

  useEffect(() => {
    if (
      backgroundType === "pixi-simple" &&
      simpleControllerRef.current
    ) {
      simpleControllerRef.current.setQuality(effectiveQuality);
      updateGlobalBackground({
        renderer: "pixi",
        quality: effectiveQuality,
        onLightSweep: () => simpleControllerRef.current?.lightSweep(),
        onPointerGlow: (active) =>
          simpleControllerRef.current?.updatePointerGlow(active),
      });
    }
  }, [backgroundType, effectiveQuality]);

  useEffect(() => {
    if (backgroundType !== "pixi-dq") {
      cleanupDragonQuestBackground();
      cleanupLegacyBackground();
      if (backgroundType !== "pixi-simple" && backgroundType !== "pixi-inferno") {
        updateGlobalBackground({
          renderer: "dom",
          quality: effectiveQuality,
        });
      }
      return undefined;
    }

    if (isLowPowerDevice || !supports3D) {
      logPixiBackground("warn", "dragon-quest-fallback-low-power", {
        reducedMotion,
        supports3D,
        gpuCapability,
        effectiveMode,
      });
      cleanupDragonQuestBackground();
      cleanupLegacyBackground();
      setBackgroundType("css");
      return undefined;
    }

    if (!mountRef.current) {
      return undefined;
    }

    cleanupSimpleBackground();
    cleanupInfernoBackground();
    cleanupLegacyBackground();

    let disposed = false;
    let detachResize: (() => void) | null = null;

    const init = async () => {
      try {
        const module = await import("@/lib/pixi/dragonQuestBackground");
        if (disposed) return;
        const controller =
          await module.createDragonQuestBackground({
            width: window.innerWidth,
            height: window.innerHeight,
            antialias: !isLowPowerDevice,
            resolution: Math.min(1.3, window.devicePixelRatio || 1),
          });

        if (!mountRef.current) {
          controller.destroy();
          return;
        }

        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(controller.canvas);
        dragonQuestControllerRef.current = controller;
        logPixiBackground("info", "dragon-quest-init-success");

        const handleResize = () => {
          controller.resize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);
        detachResize = () =>
          window.removeEventListener("resize", handleResize);

        updateGlobalBackground({
          renderer: "pixi",
          quality: effectiveQuality,
          onLightSweep: () => controller.lightSweep(),
          onLaunchFireworks: () => controller.launchFireworks(),
          onLaunchMeteors: () => controller.launchMeteors(),
        });
      } catch (error) {
        logPixiBackground("error", "dragon-quest-init-failed", error);
        if (!disposed) {
          cleanupDragonQuestBackground();
          setBackgroundType("css");
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (detachResize) {
        detachResize();
      }
      cleanupDragonQuestBackground();
      updateGlobalBackground({
        renderer: "dom",
        quality: effectiveQuality,
      });
    };
  }, [
    backgroundType,
    effectiveMode,
    effectiveQuality,
    gpuCapability,
    isLowPowerDevice,
    reducedMotion,
    supports3D,
  ]);

  useEffect(() => {
    if (backgroundType !== "pixi-inferno") {
      cleanupInfernoBackground();
      if (backgroundType !== "pixi-simple" && backgroundType !== "pixi-dq") {
        updateGlobalBackground({
          renderer: "dom",
          quality: effectiveQuality,
        });
      }
      return undefined;
    }

    if (isLowPowerDevice || !supports3D) {
      logPixiBackground("warn", "inferno-fallback-low-power", {
        reducedMotion,
        supports3D,
        gpuCapability,
        effectiveMode,
      });
      cleanupInfernoBackground();
      setBackgroundType("css");
      return undefined;
    }

    if (!mountRef.current) {
      return undefined;
    }

    cleanupSimpleBackground();
    cleanupDragonQuestBackground();
    cleanupLegacyBackground();

    let disposed = false;
    let detachResize: (() => void) | null = null;

    const init = async () => {
      try {
        const module = await import("@/lib/pixi/infernoBackground");
        if (disposed) return;
        const controller =
          await module.createInfernoBackground({
            width: window.innerWidth,
            height: window.innerHeight,
            antialias: !isLowPowerDevice,
            resolution: Math.min(1.3, window.devicePixelRatio || 1),
          });

        if (!mountRef.current) {
          controller.destroy();
          return;
        }

        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(controller.canvas);
        infernoControllerRef.current = controller;
        logPixiBackground("info", "inferno-init-success");

        const handleResize = () => {
          controller.resize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);
        detachResize = () =>
          window.removeEventListener("resize", handleResize);

        updateGlobalBackground({
          renderer: "pixi",
          quality: effectiveQuality,
          onLightSweep: () => controller.lightSweep(),
          onLaunchFireworks: () => controller.launchFireworks(),
          onLaunchMeteors: () => controller.launchMeteors(),
        });

        // 🔥 煉獄専用のメソッドをグローバルに登録
        if (window.bg) {
          window.bg.launchVolcanoEruption = () => controller.launchVolcanoEruption?.();
          window.bg.flashRed = (count?: number, duration?: number) => controller.flashRed?.(count, duration);
        }
      } catch (error) {
        logPixiBackground("error", "inferno-init-failed", error);
        if (!disposed) {
          cleanupInfernoBackground();
          setBackgroundType("css");
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (detachResize) {
        detachResize();
      }
      cleanupInfernoBackground();
      updateGlobalBackground({
        renderer: "dom",
        quality: effectiveQuality,
      });
    };
  }, [
    backgroundType,
    effectiveMode,
    effectiveQuality,
    gpuCapability,
    isLowPowerDevice,
    reducedMotion,
    supports3D,
  ]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        overflow: "hidden",
        clipPath: "inset(0)",
        contain: "strict",
        pointerEvents: "none",
        background: "var(--chakra-colors-bg-canvas)",
      }}
    />
  );
}
