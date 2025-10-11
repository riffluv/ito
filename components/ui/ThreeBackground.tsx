"use client";

import React, { useEffect, useRef, useState } from "react";
// ⚡ PERFORMANCE: Pixi.js を動的インポートに変更（初期バンドル削減）
import type * as PIXITypes from "pixi.js";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { logError, logInfo, logWarn } from "@/lib/utils/log";

type BackgroundType = "css" | "pixi";

const normalizeBackgroundType = (value: string | null): BackgroundType => {
  if (value === "pixi" || value === "pixijs") {
    return "pixi";
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

export interface ThreeBackgroundProps {
  className?: string;
}

export function ThreeBackground({ className }: ThreeBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { reducedMotion, effectiveMode, supports3D, gpuCapability } =
    useAnimationSettings();
  const isLowPowerDevice = reducedMotion || gpuCapability === "low";

  const [backgroundType, setBackgroundType] = useState<BackgroundType>("css");

  // LocalStorage から背景設定を読み込み & イベントで更新
  useEffect(() => {
    try {
      const saved = localStorage.getItem("backgroundType");
      setBackgroundType(normalizeBackgroundType(saved));
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

  // Pixi 背景
  useEffect(() => {
    if (backgroundType !== "pixi") {
      return;
    }

    if (
      isLowPowerDevice ||
      !supports3D ||
      effectiveMode === "reduce" ||
      effectiveMode === "off"
    ) {
      logPixiBackground("warn", "fallback-low-power", {
        reducedMotion,
        supports3D,
        gpuCapability,
      });
      setBackgroundType("css");
      return;
    }

    if (!mountRef.current) {
      return;
    }

    logPixiBackground("info", "init-start");

    let app: PIXITypes.Application | null = null;
    let frameId: number | undefined;
    let isAnimating = false;
    let PIXI: typeof import("pixi.js") | null = null;

    const initPixi = async () => {
      try {
        PIXI = await import("pixi.js");
        logPixiBackground("info", "pixi-loaded");

        app = new PIXI.Application();
        await app.init({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: 0x0e0f13,
          antialias: !isLowPowerDevice,
          resolution: isLowPowerDevice
            ? 1
            : Math.min(1.3, window.devicePixelRatio || 1),
          autoDensity: false,
        });

        if (!mountRef.current || !app.canvas) {
          logPixiBackground("error", "mount-missing");
          return;
        }
        mountRef.current.appendChild(app.canvas);
        logPixiBackground("info", "canvas-mounted");

        // 1. 背景グラデーション
        const bgGradient = new PIXI.Graphics();
        bgGradient.rect(0, 0, app.screen.width, app.screen.height);
        bgGradient.fill({
          color: 0x1a1b2e,
          alpha: 1,
        });
        app.stage.addChild(bgGradient);
        logPixiBackground("info", "background-gradient-created");

        // 2. 遠景の山
        const mountains = new PIXI.Graphics();
        mountains.moveTo(0, app.screen.height * 0.7);
        for (let i = 0; i <= app.screen.width; i += 100) {
          const height =
            app.screen.height * (0.7 + Math.sin(i * 0.01) * 0.15);
          mountains.lineTo(i, height);
        }
        mountains.lineTo(app.screen.width, app.screen.height);
        mountains.lineTo(0, app.screen.height);
        mountains.fill({
          color: 0x2d1b4e,
          alpha: 0.8,
        });
        app.stage.addChild(mountains);
        logPixiBackground("info", "mountains-created");

        // 3. 粒子
        interface ParticleData {
          particle: PIXITypes.Graphics;
          vx: number;
          vy: number;
          life: number;
        }
        const particles: ParticleData[] = [];
        const colors = [0xffd700, 0xffdc00, 0xffc700, 0xffed4a, 0xfff176, 0xffb300];

        for (let i = 0; i < 30; i++) {
          const particle = new PIXI.Graphics();
          particle.circle(0, 0, Math.random() * 2 + 1);
          particle.fill({
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: Math.random() * 0.6 + 0.2,
          });
          particle.x = Math.random() * app.screen.width;
          particle.y = Math.random() * app.screen.height;
          particles.push({
            particle,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.3,
            life: Math.random() * 2 + 1,
          });
          app.stage.addChild(particle);
        }
        logPixiBackground("info", "gold-particles-created");

        // 4. 前景の草
        const foreground = new PIXI.Graphics();
        const grassY = app.screen.height * 0.87;
        foreground.moveTo(0, grassY);
        for (let i = 0; i <= app.screen.width; i += 30) {
          const gentleWave = Math.sin(i * 0.008) * 12 + grassY;
          foreground.lineTo(i, gentleWave);
        }
        foreground.lineTo(app.screen.width, app.screen.height);
        foreground.lineTo(0, app.screen.height);
        foreground.fill({
          color: 0x2d5940,
          alpha: 0.8,
        });
        app.stage.addChild(foreground);

        for (let i = 0; i < 40; i++) {
          const grassAccent = new PIXI.Graphics();
          const x = Math.random() * app.screen.width;
          const y = app.screen.height * (0.88 + Math.random() * 0.08);
          const size = Math.random() * 1.5 + 0.8;
          grassAccent.circle(x, y, size);
          grassAccent.fill({
            color: 0x4a7c59,
            alpha: 0.7,
          });
          app.stage.addChild(grassAccent);
        }
        logPixiBackground("info", "grass-foreground-created");

        // アニメーション
        let lastTime = 0;
        const targetFPS = 60;
        const frameInterval = 1000 / targetFPS;
        isAnimating = true;

        if (app.ticker) {
          app.ticker.autoStart = false;
          app.ticker.stop();
        }

        const animate = (currentTime: number) => {
          if (!isAnimating) {
            return;
          }

          if (
            typeof document !== "undefined" &&
            document.visibilityState === "hidden"
          ) {
            frameId = requestAnimationFrame(animate);
            return;
          }

          if (currentTime - lastTime < frameInterval) {
            frameId = requestAnimationFrame(animate);
            return;
          }
          lastTime = currentTime;

          if (!app || !app.stage) {
            isAnimating = false;
            if (frameId) {
              cancelAnimationFrame(frameId);
              frameId = undefined;
            }
            return;
          }

          try {
            particles.forEach(({ particle, vx, vy, life }) => {
              if (!particle || !particle.parent) return;
              particle.x += vx;
              particle.y += vy;

              if (particle.x > app!.screen.width) particle.x = -10;
              if (particle.x < -10) particle.x = app!.screen.width;
              if (particle.y > app!.screen.height) particle.y = -10;
              if (particle.y < -10) particle.y = app!.screen.height;

              particle.alpha = Math.sin(currentTime * 0.001 * life) * 0.3 + 0.4;
            });

            app.renderer.render(app.stage);
          } catch (error) {
            logPixiBackground("error", "animation-error", error);
            isAnimating = false;
            return;
          }

          frameId = requestAnimationFrame(animate);
        };

        frameId = requestAnimationFrame(animate);
        logPixiBackground("info", "animation-started");
      } catch (error) {
        logPixiBackground("error", "init-failed", error);
        if (app) {
          try {
            app.destroy(true);
          } catch (destroyError) {
            logPixiBackground("warn", "destroy-error", destroyError);
          }
        }
        app = null;
        if (mountRef.current) {
          mountRef.current.style.backgroundColor = "#0E0F13";
        }
      }
    };

    initPixi();

    const handleResize = () => {
      try {
        if (app && app.renderer) {
          app.renderer.resize(window.innerWidth, window.innerHeight);
        }
      } catch (error) {
        logPixiBackground("warn", "resize-error", error);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      isAnimating = false;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = undefined;

      if (app) {
        try {
          if (app.ticker) {
            app.ticker.stop();
            app.ticker.autoStart = false;
          }
          app.stage.removeChildren();
          app.destroy(true);
        } catch (error) {
          logPixiBackground("warn", "destroy-error", error);
        }
      }
      app = null;

      if (mountRef.current) {
        mountRef.current.innerHTML = "";
        mountRef.current.style.backgroundColor = "";
      }
      logPixiBackground("info", "cleanup-complete");
    };
  }, [
    backgroundType,
    effectiveMode,
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
        background:
          backgroundType === "pixi"
            ? "var(--chakra-colors-bg-canvas)"
            : "var(--chakra-colors-bg-canvas)",
      }}
    />
  );
}
