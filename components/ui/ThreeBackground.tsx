"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as PIXITypes from "pixi.js";
import type {
  BackgroundQuality as SimpleBackgroundQuality,
  SimpleBackgroundController,
} from "@/lib/pixi/simpleBackground";
import type { DragonQuestBackgroundController } from "@/lib/pixi/dragonQuestBackground";
import type { InfernoBackgroundController } from "@/lib/pixi/infernoBackground";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { logError, logInfo, logWarn } from "@/lib/utils/log";
import { usePixiHudContext } from "@/components/ui/pixi/PixiHudStage";
import { createBackgroundHoldController } from "@/lib/pixi/backgroundHold";

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
  const pixiHud = usePixiHudContext();
  const markSharedBackgroundReady = pixiHud?.markBackgroundReady;
  const acquireBackgroundHold = pixiHud?.holdBackground;
  const notifyBackgroundReady = useCallback(() => {
    if (markSharedBackgroundReady) {
      markSharedBackgroundReady();
    }
  }, [markSharedBackgroundReady]);

  const isLowPowerDevice =
    reducedMotion || gpuCapability === "low";

  const [backgroundType, setBackgroundType] =
    useState<BackgroundType>("pixi-dq");
  const [restartKey, setRestartKey] = useState(0);

  const handleContextLoss = useCallback((tag: string) => {
    logPixiBackground("error", `${tag}-context-lost`, { tag });
    setRestartKey((value) => value + 1);
  }, []);

  useEffect(() => {
    ensureGlobalBackground();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && backgroundType !== "css") {
        setRestartKey((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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

  const effectiveQuality = useMemo<BackgroundQuality>(() => {
    if (backgroundType === "pixi-dq" || backgroundType === "pixi-inferno") {
      return "high";
    }
    if (backgroundType === "pixi-simple") {
      return "low";
    }
    return "low";
  }, [backgroundType]);

  useEffect(() => {
    if (backgroundType === "css") {
      notifyBackgroundReady();
    }
  }, [backgroundType, notifyBackgroundReady]);

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
        notifyBackgroundReady();
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

    cleanupSimpleBackground(); // ensure previous controller/app is gone before re-init

    let disposed = false;
    let detachResize: (() => void) | null = null;
    let detachContext: (() => void) | null = null;
    const holdController = createBackgroundHoldController(acquireBackgroundHold);

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

        if (disposed || !mountRef.current) {
          controller.destroy();
          holdController.release();
          return;
        }

        const canvas = controller.canvas;
        if (!canvas) {
          controller.destroy();
          setBackgroundType("css");
          holdController.release();
          return;
        }

        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(canvas);
        const onContextLost = (event: Event) => {
          event.preventDefault?.();
          if (!disposed) {
            handleContextLoss("pixi-simple");
          }
        };
        const onContextRestored = () => {
          logPixiBackground("info", "simple-context-restored");
        };
        canvas.addEventListener("webglcontextlost", onContextLost as EventListener, false);
        canvas.addEventListener(
          "webglcontextrestored",
          onContextRestored as EventListener,
          false
        );
        detachContext = () => {
          canvas.removeEventListener("webglcontextlost", onContextLost as EventListener, false);
          canvas.removeEventListener(
            "webglcontextrestored",
            onContextRestored as EventListener,
            false
          );
        };

        if (disposed) {
          controller.destroy();
          holdController.release();
          return;
        }

        simpleControllerRef.current = controller;
        logPixiBackground("info", "simple-init-success");

        let resizeFrame: number | null = null;
        let lastWidth = window.innerWidth;
        let lastHeight = window.innerHeight;
        const handleResize = () => {
          const nextWidth = window.innerWidth;
          const nextHeight = window.innerHeight;
          if (nextWidth === lastWidth && nextHeight === lastHeight) {
            return;
          }
          lastWidth = nextWidth;
          lastHeight = nextHeight;
          if (resizeFrame !== null) {
            cancelAnimationFrame(resizeFrame);
          }
          resizeFrame = window.requestAnimationFrame(() => {
            const active = simpleControllerRef.current;
            if (active) {
              active.resize(lastWidth, lastHeight);
            }
            resizeFrame = null;
          });
        };
        window.addEventListener("resize", handleResize);
        detachResize = () => {
          window.removeEventListener("resize", handleResize);
          if (resizeFrame !== null) {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = null;
          }
        };

        updateGlobalBackground({
          renderer: "pixi",
          quality: effectiveQuality,
          onLightSweep: () => controller.lightSweep(),
          onPointerGlow: (active) => controller.updatePointerGlow(active),
        });
        notifyBackgroundReady();
        holdController.release();
      } catch (error) {
        logPixiBackground("error", "simple-init-failed", error);
        if (!disposed) {
          cleanupSimpleBackground();
          setBackgroundType("css");
        }
        holdController.release();
      }
    };

    init();

    return () => {
      disposed = true;
      if (detachResize) {
        detachResize();
      }
      if (detachContext) {
        detachContext();
      }
      if (simpleControllerRef.current) {
        try {
          simpleControllerRef.current.destroy();
        } catch (error) {
          logPixiBackground("warn", "simple-cleanup-error", error);
        }
        simpleControllerRef.current = null;
      }
      holdController.release();
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
    handleContextLoss,
    restartKey,
    notifyBackgroundReady,
    acquireBackgroundHold,
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
        notifyBackgroundReady();
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

    cleanupDragonQuestBackground();
    cleanupSimpleBackground();
    cleanupInfernoBackground();
    cleanupLegacyBackground();

    let disposed = false;
    let detachResize: (() => void) | null = null;
    let detachContext: (() => void) | null = null;
    const holdController = createBackgroundHoldController(acquireBackgroundHold);

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

        if (disposed || !mountRef.current) {
          controller.destroy();
          holdController.release();
          return;
        }

        const canvas = controller.canvas;
        if (!canvas) {
          controller.destroy();
          setBackgroundType("css");
          holdController.release();
          return;
        }
        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(canvas);
        const onContextLost = (event: Event) => {
          event.preventDefault?.();
          if (!disposed) {
            handleContextLoss("pixi-dq");
          }
        };
        const onContextRestored = () => {
          logPixiBackground("info", "dragon-quest-context-restored");
        };
        canvas.addEventListener("webglcontextlost", onContextLost as EventListener, false);
        canvas.addEventListener(
          "webglcontextrestored",
          onContextRestored as EventListener,
          false
        );
        detachContext = () => {
          canvas.removeEventListener("webglcontextlost", onContextLost as EventListener, false);
          canvas.removeEventListener(
            "webglcontextrestored",
            onContextRestored as EventListener,
            false
          );
        };

        if (disposed) {
          controller.destroy();
          holdController.release();
          return;
        }

        dragonQuestControllerRef.current = controller;
        logPixiBackground("info", "dragon-quest-init-success");

        let resizeFrame: number | null = null;
        let lastWidth = window.innerWidth;
        let lastHeight = window.innerHeight;
        const handleResize = () => {
          const nextWidth = window.innerWidth;
          const nextHeight = window.innerHeight;
          if (nextWidth === lastWidth && nextHeight === lastHeight) {
            return;
          }
          lastWidth = nextWidth;
          lastHeight = nextHeight;
          if (resizeFrame !== null) {
            cancelAnimationFrame(resizeFrame);
          }
          resizeFrame = window.requestAnimationFrame(() => {
            const active = dragonQuestControllerRef.current;
            if (active) {
              active.resize(lastWidth, lastHeight);
            }
            resizeFrame = null;
          });
        };
        window.addEventListener("resize", handleResize);
        detachResize = () => {
          window.removeEventListener("resize", handleResize);
          if (resizeFrame !== null) {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = null;
          }
        };

        updateGlobalBackground({
          renderer: "pixi",
          quality: effectiveQuality,
          onLightSweep: () => controller.lightSweep(),
          onLaunchFireworks: () => controller.launchFireworks(),
          onLaunchMeteors: () => controller.launchMeteors(),
        });
        notifyBackgroundReady();
        holdController.release();
      } catch (error) {
        logPixiBackground("error", "dragon-quest-init-failed", error);
        if (!disposed) {
          cleanupDragonQuestBackground();
          setBackgroundType("css");
        }
        holdController.release();
      }
    };

    init();

    return () => {
      disposed = true;
      if (detachResize) {
        detachResize();
      }
      if (detachContext) {
        detachContext();
      }
      cleanupDragonQuestBackground();
      holdController.release();
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
    handleContextLoss,
    restartKey,
    notifyBackgroundReady,
    acquireBackgroundHold,
  ]);

  useEffect(() => {
    if (backgroundType !== "pixi-inferno") {
      cleanupInfernoBackground();
      if (backgroundType !== "pixi-simple" && backgroundType !== "pixi-dq") {
        updateGlobalBackground({
          renderer: "dom",
          quality: effectiveQuality,
        });
        notifyBackgroundReady();
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

    cleanupInfernoBackground();
    cleanupSimpleBackground();
    cleanupDragonQuestBackground();
    cleanupLegacyBackground();

    let disposed = false;
    let detachResize: (() => void) | null = null;
    let detachContext: (() => void) | null = null;
    const holdController = createBackgroundHoldController(acquireBackgroundHold);

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

        if (disposed || !mountRef.current) {
          controller.destroy();
          holdController.release();
          return;
        }

        const canvas = controller.canvas;
        if (!canvas) {
          controller.destroy();
          setBackgroundType("css");
          holdController.release();
          return;
        }
        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(canvas);
        const onContextLost = (event: Event) => {
          event.preventDefault?.();
          if (!disposed) {
            handleContextLoss("pixi-inferno");
          }
        };
        const onContextRestored = () => {
          logPixiBackground("info", "inferno-context-restored");
        };
        canvas.addEventListener("webglcontextlost", onContextLost as EventListener, false);
        canvas.addEventListener(
          "webglcontextrestored",
          onContextRestored as EventListener,
          false
        );
        detachContext = () => {
          canvas.removeEventListener("webglcontextlost", onContextLost as EventListener, false);
          canvas.removeEventListener(
            "webglcontextrestored",
            onContextRestored as EventListener,
            false
          );
        };

        if (disposed) {
          controller.destroy();
          holdController.release();
          return;
        }

        infernoControllerRef.current = controller;
        logPixiBackground("info", "inferno-init-success");

        let resizeFrame: number | null = null;
        let lastWidth = window.innerWidth;
        let lastHeight = window.innerHeight;
        const handleResize = () => {
          const nextWidth = window.innerWidth;
          const nextHeight = window.innerHeight;
          if (nextWidth === lastWidth && nextHeight === lastHeight) {
            return;
          }
          lastWidth = nextWidth;
          lastHeight = nextHeight;
          if (resizeFrame !== null) {
            cancelAnimationFrame(resizeFrame);
          }
          resizeFrame = window.requestAnimationFrame(() => {
            const active = infernoControllerRef.current;
            if (active) {
              active.resize(lastWidth, lastHeight);
            }
            resizeFrame = null;
          });
        };
        window.addEventListener("resize", handleResize);
        detachResize = () => {
          window.removeEventListener("resize", handleResize);
          if (resizeFrame !== null) {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = null;
          }
        };

        updateGlobalBackground({
          renderer: "pixi",
          quality: effectiveQuality,
          onLightSweep: () => controller.lightSweep(),
          onLaunchFireworks: () => controller.launchFireworks(),
          onLaunchMeteors: () => controller.launchMeteors(),
        });
        notifyBackgroundReady();
        holdController.release();

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
        holdController.release();
      }
    };

    init();

    return () => {
      disposed = true;
      if (detachResize) {
        detachResize();
      }
      if (detachContext) {
        detachContext();
      }
      cleanupInfernoBackground();
      holdController.release();
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
    handleContextLoss,
    restartKey,
    notifyBackgroundReady,
    acquireBackgroundHold,
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
