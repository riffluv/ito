"use client";

import { useEffect, useRef } from "react";
import { usePixiHudContext, usePixiHudLayer } from "@/components/ui/pixi/PixiHudStage";
import type { VictoryRaysController } from "@/lib/pixi/victoryRays";
import type { Container } from "pixi.js";

// 共有インスタンスをモジュールスコープに保持
let sharedController: VictoryRaysController | null = null;
let sharedInitPromise: Promise<VictoryRaysController | null> | null = null;

export const getSharedVictoryRays = () => sharedController;

export async function ensureSharedVictoryRays(
  opts: {
    container: Container;
    centerX: number;
    centerY: number;
  },
  load: () => Promise<typeof import("@/lib/pixi/victoryRays")>
): Promise<VictoryRaysController | null> {
  if (sharedController) return sharedController;
  if (sharedInitPromise) return sharedInitPromise;

  sharedInitPromise = (async () => {
    try {
      const { createVictoryRays } = await load();
      const controller = await createVictoryRays(opts);
      sharedController = controller;
      return controller;
    } catch (error) {
      console.warn("[VictoryRaysPrewarm] init failed", error);
      sharedController = null;
      return null;
    } finally {
      sharedInitPromise = null;
    }
  })();

  return sharedInitPromise;
}

export function VictoryRaysPrewarm() {
  const layer = usePixiHudLayer("victory-rays", { zIndex: 9998 });
  const pixi = usePixiHudContext();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!layer) return;
    startedRef.current = true;

    const run = async () => {
      try {
        await pixi?.waitForHudReady?.();
        await pixi?.waitForRendererReady?.();
        const centerX = typeof window !== "undefined" ? window.innerWidth / 2 : 960;
        const centerY = typeof window !== "undefined" ? window.innerHeight / 2 : 540;
        await ensureSharedVictoryRays(
          { container: layer, centerX, centerY },
          () => import("@/lib/pixi/victoryRays")
        );
        await pixi?.renderOnce?.("victoryRays:prewarm");
      } catch (error) {
        console.warn("[VictoryRaysPrewarm] warmup failed", error);
      }
    };

    void run();
  }, [layer, pixi]);

  return null;
}

export default VictoryRaysPrewarm;
