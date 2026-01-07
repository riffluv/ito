import {
  usePixiHudContext,
  usePixiHudLayer,
} from "@/components/ui/pixi/PixiHudStage";
import type { VictoryRaysController } from "@/lib/pixi/victoryRays";
import { chakra } from "@chakra-ui/react";
import { gsap } from "gsap";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

export type GameResultOverlayMode = "overlay" | "inline";

// 環境変数で切り替え（デフォルトは Pixi 版）
const USE_PIXI_RAYS = process.env.NEXT_PUBLIC_USE_PIXI_RAYS !== "0";

export const VICTORY_TITLE = "🏆 勝利！";
export const FAILURE_TITLE = "💀 失敗…";
export const VICTORY_SUBTEXT = "みんなの連携が実を結びました！";
export const FAILURE_SUBTEXT = "もう一度チャレンジしてみましょう。";

type BackgroundFxHandles = {
  launchFireworks?: () => void;
  launchMeteors?: () => void;
  lightSweep?: () => void;
};

// SVG 版（バックアップ・フォールバック用）
const RAY_ANGLES = [0, 43, 88, 137, 178, 223, 271, 316] as const;
const RAY_THICKNESS = 36;
const RAY_LENGTH = 1900;
const VIEWBOX_EXTENT = RAY_LENGTH * 3.5;

export type VictoryBurstRaysProps = {
  registerRayRef: (index: number) => (node: SVGRectElement | null) => void;
};

export function VictoryBurstRaysSVG({ registerRayRef }: VictoryBurstRaysProps) {
  const gradientBaseId = useId();
  const gradientId = `${gradientBaseId}-victory-ray`;
  const filterId = `${gradientBaseId}-victory-glow`;

  return (
    <chakra.svg
      aria-hidden="true"
      position="fixed"
      inset={0}
      width="100%"
      height="100%"
      viewBox={`${-VIEWBOX_EXTENT} ${-VIEWBOX_EXTENT} ${VIEWBOX_EXTENT * 2} ${VIEWBOX_EXTENT * 2}`}
      pointerEvents="none"
      zIndex={9998}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" x2="100%" y1="50%" y2="50%">
          <stop offset="0%" stopColor="#fffbe6" stopOpacity="1" />
          <stop offset="22%" stopColor="#ffeeb3" stopOpacity="0.96" />
          <stop offset="55%" stopColor="#ffd45c" stopOpacity="0.72" />
          <stop offset="82%" stopColor="#ffb347" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={filterId} x="-80%" y="-160%" width="260%" height="420%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {RAY_ANGLES.map((angle, index) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <rect
            ref={registerRayRef(index)}
            x={0}
            y={-RAY_THICKNESS / 2}
            width={RAY_LENGTH}
            height={RAY_THICKNESS}
            fill={`url(#${gradientId})`}
            opacity={0}
            filter={`url(#${filterId})`}
            style={{
              transformBox: "fill-box",
              transformOrigin: "0% 50%",
            }}
          />
        </g>
      ))}
    </chakra.svg>
  );
}

type VictoryRaysHookResult = {
  usePixiRays: boolean;
  useSvgRays: boolean;
  pixiRaysReady: boolean;
  pixiRaysController: VictoryRaysController | null;
  registerLineRef: (index: number) => (node: SVGRectElement | null) => void;
  linesRef: MutableRefObject<(SVGRectElement | null)[]>;
  initFailed: boolean;
};

export function useVictoryRaysLayer(options: {
  prefersReduced: boolean;
  mode: GameResultOverlayMode;
}): VictoryRaysHookResult {
  const { prefersReduced, mode } = options;
  const [allowPixi, setAllowPixi] = useState(true);
  const pixiRaysLayer = usePixiHudLayer("victory-rays", { zIndex: 9998 });
  const pixiHudContext = usePixiHudContext();
  const [pixiRaysController, setPixiRaysController] =
    useState<VictoryRaysController | null>(null);
  const [initFailed, setInitFailed] = useState(false);
  const victoryRaysModuleRef = useRef<Promise<
    typeof import("@/lib/pixi/victoryRays")
  > | null>(null);
  const gsapRenderCancelRef = useRef<(() => void) | null>(null);

  const usePixiRays =
    USE_PIXI_RAYS && allowPixi && !!pixiRaysLayer && !prefersReduced;
  const pixiRaysReady = usePixiRays && !!pixiRaysController;
  const useSvgRays = !pixiRaysReady;

  const linesRef = useRef<(SVGRectElement | null)[]>([]);
  const registerLineRef = useCallback(
    (index: number) => (node: SVGRectElement | null) => {
      linesRef.current[index] = node;
    },
    []
  );

  // モジュールを事前ロード（初回の待ち時間を最小化）
  useEffect(() => {
    if (!usePixiRays) return;
    if (!victoryRaysModuleRef.current) {
      victoryRaysModuleRef.current = import("@/lib/pixi/victoryRays");
    }
  }, [usePixiRays]);

  // 低性能 WebGL を検出したら初回は SVG にフォールバック
  useEffect(() => {
    let cancelled = false;
    const detect = () => {
      try {
        const canvas = document.createElement("canvas");
        const gl = (canvas.getContext("webgl", {
          failIfMajorPerformanceCaveat: true,
        }) ||
          canvas.getContext("experimental-webgl", {
            failIfMajorPerformanceCaveat: true,
          })) as
          | (WebGLRenderingContext & {
              getExtension?: typeof WebGLRenderingContext.prototype.getExtension;
            })
          | null;
        if (!gl) {
          if (!cancelled) setAllowPixi(false);
          return;
        }
        const dbg = gl.getExtension?.("WEBGL_debug_renderer_info") as
          | { UNMASKED_RENDERER_WEBGL: number }
          | null
          | undefined;
        const renderer =
          dbg && gl.getParameter
            ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter?.(
                (gl as unknown as WebGLRenderingContext).RENDERER ?? 0
              );
        const lowPerf =
          typeof renderer === "string" &&
          /swiftshader|software/i.test(renderer);
        if (!cancelled && lowPerf) {
          setAllowPixi(false);
        }
      } catch {
        // 無視
      }
    };
    if (typeof window !== "undefined") {
      detect();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Pixi 放射ラインの初期化
  useEffect(() => {
    if (!usePixiRays || mode !== "overlay") {
      return undefined;
    }

    let controller: VictoryRaysController | null = null;
    let mounted = true;

    const init = async () => {
      try {
        // 【重要】PixiHudStage の初期化完了を確実に待つ（スマホ環境で必須）
        if (pixiHudContext?.waitForHudReady) {
          const app = await pixiHudContext.waitForHudReady();
          if (!app) {
            console.error(
              "[useVictoryRaysLayer] PixiHudStage initialization failed"
            );
            setPixiRaysController(null);
            setInitFailed(true);
            return;
          }
          // 初回アクセス時に ticker が停止しているケースを救済
          if (app.ticker && !app.ticker.started) {
            app.ticker.start();
          }
          // 念のため GSAP ticker でもレンダリングを駆動し、低速GPUでの停止を防ぐ
          if (!gsapRenderCancelRef.current) {
            const renderWithGsap = () => {
              try {
                app.renderer.render(app.stage);
              } catch {
                // ignore
              }
            };
            gsap.ticker.add(renderWithGsap);
            gsapRenderCancelRef.current = () =>
              gsap.ticker.remove(renderWithGsap);
          }
        }

        const modulePromise =
          victoryRaysModuleRef.current ?? import("@/lib/pixi/victoryRays");
        victoryRaysModuleRef.current = modulePromise;
        const { createVictoryRays } = await modulePromise;
        if (!mounted || !pixiRaysLayer) return;

        const centerX =
          typeof window !== "undefined" ? window.innerWidth / 2 : 960;
        const centerY =
          typeof window !== "undefined" ? window.innerHeight / 2 : 540;

        controller = await createVictoryRays({
          container: pixiRaysLayer,
          centerX,
          centerY,
        });

        if (mounted) {
          setPixiRaysController(controller);
          setInitFailed(false);

          // グラボなし端末対策: 生成直後にGPUへ確実にアップロード＆描画
          // Pixi.js 8 では prepare プラグインが削除されているため、
          // 代わりに確実に renderOnce を実行して GPU に描画内容をアップロードする
          try {
            const prevAlpha = pixiRaysLayer.alpha;
            const prevVisible = pixiRaysLayer.visible;

            // 微小表示で描画（GPU にアップロード）
            pixiRaysLayer.alpha = 0.001;
            pixiRaysLayer.visible = true;

            // ウォームアップレンダリングを確実に待つ（await で同期）
            if (pixiHudContext?.renderOnce) {
              await pixiHudContext.renderOnce("victoryRays:warmup");

              // もう1フレーム待って確実にGPU処理を完了させる
              await new Promise<void>((resolve) => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    resolve();
                  });
                });
              });
            }

            // 元の状態に戻す
            pixiRaysLayer.alpha = prevAlpha;
            pixiRaysLayer.visible = prevVisible;
          } catch (error) {
            console.warn("[useVictoryRaysLayer] warmup failed", error);
          }
        }
      } catch (error) {
        console.warn("[useVictoryRaysLayer] failed to init pixi rays", error);
        setPixiRaysController(null);
        setInitFailed(true);
      }
    };

    init();

    return () => {
      mounted = false;
      if (controller) {
        controller.destroy();
      }
      setPixiRaysController(null);
      if (gsapRenderCancelRef.current) {
        gsapRenderCancelRef.current();
        gsapRenderCancelRef.current = null;
      }
    };
  }, [mode, pixiRaysLayer, prefersReduced, usePixiRays, pixiHudContext]);

  return {
    usePixiRays,
    useSvgRays,
    pixiRaysReady,
    pixiRaysController,
    registerLineRef,
    linesRef,
    initFailed,
  };
}

export function useBackgroundFx(prefersReduced: boolean) {
  const bgFxRafRef = useRef<number | null>(null);

  const triggerBackgroundFx = useCallback(
    (effect: "fireworks" | "meteors" | "lightSweep") => {
      if (prefersReduced || typeof window === "undefined") return;
      if (bgFxRafRef.current) {
        cancelAnimationFrame(bgFxRafRef.current);
      }
      bgFxRafRef.current = requestAnimationFrame(() => {
        const globalWindow = window as Window & { bg?: BackgroundFxHandles };
        const bg = globalWindow.bg;
        if (!bg) return;
        try {
          if (effect === "fireworks") {
            bg.launchFireworks?.();
          } else if (effect === "meteors") {
            bg.launchMeteors?.();
          } else {
            bg.lightSweep?.();
          }
        } catch (error) {
          console.warn(`[GameResultOverlay] bg.${effect} failed`, error);
        } finally {
          bgFxRafRef.current = null;
        }
      });
    },
    [prefersReduced]
  );

  useEffect(() => {
    return () => {
      if (bgFxRafRef.current) {
        cancelAnimationFrame(bgFxRafRef.current);
      }
    };
  }, []);

  return triggerBackgroundFx;
}

