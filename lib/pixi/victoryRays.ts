import type * as PIXI from "pixi.js";
import { gsap } from "gsap";

const RAY_ANGLES = [0, 43, 88, 137, 178, 223, 271, 316] as const;
const RAY_THICKNESS = 36;
const RAY_BASE_LENGTH = 1900;

export interface VictoryRaysController {
  destroy(): void;
  playExplosion(): void;
}

export interface VictoryRaysOptions {
  container: PIXI.Container;
  centerX: number;
  centerY: number;
}

/**
 * Pixi.js で勝利の放射ラインを生成
 * SVG 版と同じ見た目を GPU レンダリングで実現
 */
export async function createVictoryRays(
  options: VictoryRaysOptions
): Promise<VictoryRaysController> {
  const pixi = (await import("pixi.js")) as typeof PIXI;
  const { PixiPlugin } = await import("gsap/PixiPlugin");

  gsap.registerPlugin(PixiPlugin);
  PixiPlugin.registerPIXI(pixi);

  const { container, centerX, centerY } = options;
  const rays: PIXI.Graphics[] = [];

  // 各角度でラインを生成
  RAY_ANGLES.forEach((angle) => {
    const ray = new pixi.Graphics();

    // グラデーション風の描画（複数の矩形を重ねる）
    const segments = 5;
    for (let i = 0; i < segments; i++) {
      const progress = i / segments;
      const nextProgress = (i + 1) / segments;

      const startX = RAY_BASE_LENGTH * progress;
      const endX = RAY_BASE_LENGTH * nextProgress;
      const width = endX - startX;

      // グラデーションカラー（左から右へフェード）
      let alpha = 1 - progress * 0.7; // 1.0 → 0.3
      if (progress > 0.7) {
        alpha = 0.3 * (1 - (progress - 0.7) / 0.3); // 0.3 → 0
      }

      ray.rect(startX, -RAY_THICKNESS / 2, width, RAY_THICKNESS);
      ray.fill({
        color: progress < 0.22 ? 0xfffbe6 :
               progress < 0.55 ? 0xffd45c :
               progress < 0.82 ? 0xffb347 : 0xffffff,
        alpha: alpha * 0.8,
      });
    }

    // 回転とポジション設定
    ray.rotation = (angle * Math.PI) / 180;
    ray.pivot.set(0, 0);
    ray.position.set(centerX, centerY);
    ray.alpha = 0;
    ray.scale.set(0, 1);

    container.addChild(ray);
    rays.push(ray);
  });

  let explosionTimeline: gsap.core.Timeline | null = null;

  const playExplosion = () => {
    if (explosionTimeline) {
      explosionTimeline.kill();
    }

    const tl = gsap.timeline();
    explosionTimeline = tl;

    // 【第1波】LEFT から爆発（0.05s）
    [0, 1, 7].forEach((index) => {
      const ray = rays[index];
      if (!ray) return;
      tl.fromTo(
        ray,
        { pixi: { scaleX: 0, alpha: 1 } },
        {
          pixi: { scaleX: 4.6, alpha: 0 },
          duration: 0.58,
          ease: "power3.out",
        },
        0.05
      );
    });

    // 【第2波】RIGHT から爆発（0.15s）
    [3, 4, 5].forEach((index) => {
      const ray = rays[index];
      if (!ray) return;
      tl.fromTo(
        ray,
        { pixi: { scaleX: 0, alpha: 1 } },
        {
          pixi: { scaleX: 4.6, alpha: 0 },
          duration: 0.58,
          ease: "power3.out",
        },
        0.15
      );
    });

    // 【第3波】CENTER（上下）から爆発（0.25s）
    [2, 6].forEach((index) => {
      const ray = rays[index];
      if (!ray) return;
      tl.fromTo(
        ray,
        { pixi: { scaleX: 0, alpha: 1 } },
        {
          pixi: { scaleX: 5.4, alpha: 0 },
          duration: 0.83,
          ease: "power4.out",
        },
        0.25
      );
    });
  };

  return {
    playExplosion,
    destroy() {
      if (explosionTimeline) {
        explosionTimeline.kill();
        explosionTimeline = null;
      }
      rays.forEach((ray) => {
        container.removeChild(ray);
        ray.destroy();
      });
      rays.length = 0;
    },
  };
}
