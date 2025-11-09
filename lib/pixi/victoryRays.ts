import type * as PIXI from "pixi.js";
import { loadPixi } from "./loadPixi";
import { gsap } from "gsap";

const RAY_ANGLES = [0, 43, 88, 137, 178, 223, 271, 316] as const;
// AI感排除：線幅を微妙に可変（均一を避ける）
const RAY_THICKNESS_BASE = 19;
const RAY_THICKNESS_VARIATION = [0, 2, -1, 1, -2, 3, 1, -1]; // 各ラインの微差
const RAY_BASE_LENGTH = 2400; // より長く、颯爽と

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
  const pixi = await loadPixi();
  const { PixiPlugin } = await import("gsap/PixiPlugin");

  gsap.registerPlugin(PixiPlugin);
  PixiPlugin.registerPIXI(pixi);

  const { container, centerX, centerY } = options;
  const rays: PIXI.Graphics[] = [];

  // 各角度でラインを生成
  RAY_ANGLES.forEach((angle, index) => {
    const ray = new pixi.Graphics();
    const thickness = RAY_THICKNESS_BASE + RAY_THICKNESS_VARIATION[index];

    // AI感排除：グラデーションに微差を入れる（不等間隔セグメント）
    const segments = 7; // より細かく
    const segmentOffsets = [0, 0.12, 0.28, 0.47, 0.68, 0.85, 1.0]; // 不等間隔！

    for (let i = 0; i < segments - 1; i++) {
      const progress = segmentOffsets[i];
      const nextProgress = segmentOffsets[i + 1];

      const startX = RAY_BASE_LENGTH * progress;
      const endX = RAY_BASE_LENGTH * nextProgress;
      const width = endX - startX;

      // AI感排除：アルファ値に微差（均一を避ける）
      let alpha = 1.0 - progress * 0.82; // 1.0 → 0.18
      if (progress > 0.68) {
        alpha = 0.18 * (1 - (progress - 0.68) / 0.32); // 0.18 → 0
      }
      // 微妙なゆらぎ
      alpha *= (0.96 + (index % 3) * 0.02);

      ray.rect(startX, -thickness / 2, width, thickness);
      ray.fill({
        color: progress < 0.12 ? 0xfffbe6 :
               progress < 0.28 ? 0xffeeb3 :
               progress < 0.47 ? 0xffd45c :
               progress < 0.68 ? 0xffb347 : 0xffffff,
        alpha: alpha * 0.87, // 少し控えめ
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

    // AI感排除：不等間隔タイミング + 手癖easing
    const handEasing = "cubic-bezier(.2,1,.3,1)";

    // 【第1波】LEFT から爆発（颯爽と速く！）
    [0, 1, 7].forEach((index, i) => {
      const ray = rays[index];
      if (!ray) return;
      tl.fromTo(
        ray,
        { pixi: { scaleX: 0, alpha: 1 } },
        {
          pixi: { scaleX: 5.2, alpha: 0 }, // より長く
          duration: 0.43, // より速く（0.58 → 0.43）
          ease: handEasing,
        },
        0.03 + i * 0.017 // 不等間隔（0.017差）
      );
    });

    // 【第2波】RIGHT から爆発（微妙にズラす）
    [3, 4, 5].forEach((index, i) => {
      const ray = rays[index];
      if (!ray) return;
      tl.fromTo(
        ray,
        { pixi: { scaleX: 0, alpha: 1 } },
        {
          pixi: { scaleX: 5.3, alpha: 0 },
          duration: 0.46,
          ease: handEasing,
        },
        0.11 + i * 0.019 // 不等間隔（0.019差）
      );
    });

    // 【第3波】CENTER（上下）から爆発（少し遅らせて強調）
    [2, 6].forEach((index, i) => {
      const ray = rays[index];
      if (!ray) return;
      tl.fromTo(
        ray,
        { pixi: { scaleX: 0, alpha: 1 } },
        {
          pixi: { scaleX: 6.1, alpha: 0 }, // 最も長く
          duration: 0.67, // 少し長め
          ease: "power4.out", // 中央は強調
        },
        0.21 + i * 0.023 // 不等間隔（0.023差）
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
