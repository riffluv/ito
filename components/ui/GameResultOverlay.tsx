import { Box, Text, chakra } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { useSoundManager } from "@/lib/audio/SoundProvider";
import { usePixiHudLayer } from "@/components/ui/pixi/PixiHudStage";
import type { VictoryRaysController } from "@/lib/pixi/victoryRays";

// 環境変数で切り替え（デフォルトは Pixi 版）
const USE_PIXI_RAYS = process.env.NEXT_PUBLIC_USE_PIXI_RAYS !== "0";

type BackgroundFxHandles = {
  launchFireworks?: () => void;
  launchMeteors?: () => void;
  lightSweep?: () => void;
};

const VICTORY_TITLE = "🏆 勝利！";
const FAILURE_TITLE = "💀 失敗…";
const VICTORY_SUBTEXT = "みんなの連携が実を結びました！";
const FAILURE_SUBTEXT = "もう一度チャレンジしてみましょう。";

// SVG 版（バックアップ・フォールバック用）
const RAY_ANGLES = [0, 43, 88, 137, 178, 223, 271, 316] as const;
const RAY_THICKNESS = 36;
const RAY_LENGTH = 1900;
const VIEWBOX_EXTENT = RAY_LENGTH * 3.5;

interface VictoryBurstRaysProps {
  registerRayRef: (index: number) => (node: SVGRectElement | null) => void;
}

function VictoryBurstRaysSVG({ registerRayRef }: VictoryBurstRaysProps) {
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

function useVictoryRaysLayer(options: {
  prefersReduced: boolean;
  mode: "overlay" | "inline";
}): VictoryRaysHookResult {
  const { prefersReduced, mode } = options;
  const pixiRaysLayer = usePixiHudLayer("victory-rays", { zIndex: 9998 });
  const [pixiRaysController, setPixiRaysController] = useState<VictoryRaysController | null>(null);
  const [initFailed, setInitFailed] = useState(false);
  const victoryRaysModuleRef = useRef<Promise<typeof import("@/lib/pixi/victoryRays")> | null>(null);

  const usePixiRays = USE_PIXI_RAYS && !!pixiRaysLayer && !prefersReduced;
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

  // Pixi 放射ラインの初期化
  useEffect(() => {
    if (!usePixiRays || mode !== "overlay") {
      return undefined;
    }

    let controller: VictoryRaysController | null = null;
    let mounted = true;

    const init = async () => {
      try {
        const modulePromise =
          victoryRaysModuleRef.current ?? import("@/lib/pixi/victoryRays");
        victoryRaysModuleRef.current = modulePromise;
        const { createVictoryRays } = await modulePromise;
        if (!mounted || !pixiRaysLayer) return;

        const centerX = typeof window !== "undefined" ? window.innerWidth / 2 : 960;
        const centerY = typeof window !== "undefined" ? window.innerHeight / 2 : 540;

        controller = await createVictoryRays({
          container: pixiRaysLayer,
          centerX,
          centerY,
        });

        if (mounted) {
          setPixiRaysController(controller);
          setInitFailed(false);
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
    };
  }, [mode, pixiRaysLayer, prefersReduced, usePixiRays]);

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

function useBackgroundFx(prefersReduced: boolean) {
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

interface GameResultOverlayProps {
  failed?: boolean;
  mode?: "overlay" | "inline"; // overlay: 中央に被せる, inline: 帯として表示
  revealedAt?: unknown;
}

export function GameResultOverlay({
  failed,
  mode = "overlay",
  revealedAt,
}: GameResultOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Timeline を再利用（GC 負荷削減）
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const timeline = useMemo(() => gsap.timeline({ paused: true }), []);
  const prefersReduced = useReducedMotionPreference();
  const {
    usePixiRays: _usePixiRays,
    useSvgRays: _legacyUseSvgRays,
    pixiRaysReady,
    pixiRaysController,
    registerLineRef,
    linesRef,
    initFailed,
  } = useVictoryRaysLayer({ prefersReduced, mode });
  const preferPixiRays = _usePixiRays;
  const [webglUsable] = useState(() => {
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { powerPreference: "high-performance" }) ||
      canvas.getContext("webgl", { powerPreference: "high-performance" }) ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  });

  // Pixi を優先し、WebGL が無い / 初期化失敗時のみ SVG を許可
  const useSvgRays =
    (!preferPixiRays || initFailed || !webglUsable) && _legacyUseSvgRays;
  const triggerBackgroundFx = useBackgroundFx(prefersReduced);
  const playSuccessNormal = useSoundEffect("clear_success1");
  const playSuccessEpic = useSoundEffect("clear_success2");
  const playFailure = useSoundEffect("clear_failure");
  const soundManager = useSoundManager();

  const resolveRevealTimestamp = useCallback((): number | null => {
    if (revealedAt === null || typeof revealedAt === "undefined") return null;
    if (typeof revealedAt === "number") return revealedAt;
    if (revealedAt instanceof Date) return revealedAt.getTime();
    if (typeof revealedAt === "object") {
      const value = revealedAt as {
        toMillis?: () => number;
        seconds?: number;
        nanoseconds?: number;
      };
      if (typeof value.toMillis === "function") {
        try {
          return value.toMillis();
        } catch {
          return null;
        }
      }
      if (typeof value.seconds === "number" && typeof value.nanoseconds === "number") {
        return value.seconds * 1000 + Math.floor(value.nanoseconds / 1_000_000);
      }
    }
    return null;
  }, [revealedAt]);

  const playbackKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const currentSettings = soundManager?.getSettings();
    const successMode = currentSettings?.successMode ?? "normal";
    const timestamp = resolveRevealTimestamp();
    const key = `${mode}:${failed ? "fail" : successMode}:${timestamp ?? "none"}`;

    if (playbackKeyRef.current === key) {
      return;
    }

    playbackKeyRef.current = key;

    if (revealedAt === null || typeof revealedAt === "undefined") {
      return;
    }

    const now = Date.now();
    const isFreshReveal = timestamp === null || now - timestamp <= 6000;
    if (!isFreshReveal) {
      return;
    }

    if (mode !== "overlay") {
      if (failed) {
        playFailure();
      } else if (successMode === "epic") {
        playSuccessEpic();
      } else {
        playSuccessNormal();
      }
      return;
    }

    if (!failed && successMode === "epic") {
      playSuccessEpic();
    }
  }, [failed, mode, playFailure, playSuccessNormal, playSuccessEpic, resolveRevealTimestamp, revealedAt, soundManager]);

  useEffect(() => {
    if (mode !== "overlay" || typeof window === "undefined") {
      return undefined;
    }
    const root = document.documentElement;
    const body = document.body;
    const prevRootOverflow = root.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      root.style.overflow = prevRootOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "overlay") return undefined;
    const overlay = overlayRef.current;
    const text = textRef.current;
    const container = containerRef.current;
    const flashNode = flashRef.current;
    const lineNodesSnapshot = useSvgRays ? [...linesRef.current] : null;
    if (!overlay || !text || !container) return undefined;

    // GPU アクセラレーションを強制（force3D）
    gsap.set([container, overlay, text], { force3D: true });

    if (prefersReduced) {
      gsap.set(container, {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        rotation: 0,
      });
      gsap.set(overlay, { opacity: 1, scale: 1, rotationX: 0, rotationY: 0 });
      gsap.set(text, { opacity: 1, y: 0, scale: 1 });
      return undefined;
    }

    // Timeline を再利用（クリアして再スタート）
    const tl = timeline.clear().pause();
    tlRef.current = tl;

    if (failed) {
      // ドラクエ風劇的失敗演出！ + 落下演出

      // 失敗時の初期位置設定（container全体を完全に画面上外に）
      gsap.set(container, {
        xPercent: -50,
        yPercent: -50,
        y: -1000, // より高い位置から（完全に見えない位置）
        x: 0,
        rotation: 0,
        opacity: 0, // container ごと透明
      });

      gsap.set(overlay, {
        opacity: 0,
        scale: 0.6,
        rotation: -8,
        filter: "blur(12px) brightness(0.3) saturate(0.4)",
      });

      gsap.set(text, {
        opacity: 0,
      });

      if (flashNode) {
        gsap.set(flashNode, {
          opacity: 0,
          backgroundColor: "black",
        });
      }

      // ====================================================
      // Phase 0: 黒フラッシュ（画面が暗くなる）
      // ====================================================
      if (flashNode) {
        tl.fromTo(
          flashNode,
          { opacity: 0, backgroundColor: "black" },
          {
            opacity: 0.7, // 少し暗く
            duration: 0.17,
            ease: "power2.in",
          }
        )
        .to(flashNode, {
          opacity: 0.3, // 完全に消さず、暗いまま
          duration: 0.28,
          ease: "power2.out"
        });
      }
      tl
      .call(() => triggerBackgroundFx("lightSweep"), undefined, "<");

      // ====================================================
      // Phase 0.5: 失敗BOXが上から落ちてくる！
      // ====================================================
      tl.to(
        container,
        {
          opacity: 1, // container を表示
          y: -50, // 少し上から落ちる
          duration: 0.48,
          ease: "power2.in", // 重力で加速
        },
        0.2 // 黒フラッシュの後
      )
      .to(
        overlay,
        {
          opacity: 1,
          scale: 0.9,
          rotation: 3,
          filter: "blur(2px) brightness(0.6) saturate(0.5)",
          duration: 0.48,
          ease: "power2.in",
        },
        0.2 // container と同時
      )

      // ====================================================
      // Phase 1: ドスン！着地
      // ====================================================
      .to(container, {
        y: 0, // 中央に着地
        duration: 0.14,
        ease: "power4.out",
      })
      .to(overlay, {
        scale: 1.1, // 着地の衝撃で広がる
        rotation: 0,
        filter: "blur(0px) brightness(0.7) saturate(0.6)",
        duration: 0.14,
        ease: "power4.out",
      }, "-=0.14")

      // 着地の反動（潰れる）
      .to(overlay, {
        scale: 0.95,
        duration: 0.11,
        ease: "power2.in"
      });

      // ====================================================
      // Phase 1.5: 着地時のシェイク（ドスン！）
      // ====================================================
      tl.to(
        container,
        {
          y: 6,
          duration: 0.05,
          repeat: 6,
          yoyo: true,
          ease: "power2.inOut",
          onStart: () => {
            playFailure();
          },
        },
        0.85 // 着地と同時
      )
      // シェイク後、中央に戻す
      .to(container, {
        y: 0,
        duration: 0.17,
        ease: "power2.out"
      });

      // Phase 2: 重苦しい膨張
      tl.to(overlay, {
        scale: 1.15,
        duration: 0.37,
        ease: "power2.out",
      })

      // Phase 3: テキスト重たい登場
      .fromTo(
        text,
        {
          opacity: 0,
          y: -30,
          scale: 1.4,
          rotationX: -20,
          filter: "blur(3px)"
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotationX: 0,
          filter: "blur(0px)",
          duration: 0.52,
          ease: "power3.out",
        },
        "-=0.2"
      )
      .call(() => triggerBackgroundFx("meteors"), undefined, ">")

      // Phase 4: 激しい振動（地震のような）
      .to(overlay, {
        x: () => gsap.utils.random(-15, 15),
        y: () => gsap.utils.random(-8, 8),
        rotation: () => gsap.utils.random(-2, 2),
        duration: 0.06,
        repeat: 20,
        yoyo: true,
        ease: "power2.inOut",
      })

      // Phase 5: 重力落下演出
      .to(overlay, {
        y: 15,
        scale: 1.05,
        duration: 0.6,
        ease: "bounce.out"
      })
      .to(text, {
        y: 5,
        duration: 0.6,
        ease: "bounce.out"
      }, "-=0.6")

      // Phase 6: 最終位置へ重たく安定（一定の暗さで固定）
      .to(overlay, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        filter: "brightness(0.65) saturate(0.6)",
        boxShadow: "0 0 12px rgba(139,0,0,0.4), inset 0 0 8px rgba(0,0,0,0.6)",
        duration: 0.4,
        ease: "power3.out"
      })
      .to(text, {
        y: 0,
        duration: 0.4,
        ease: "power3.out"
      }, "-=0.4")

      // Phase 7: 自然な永続浮遊（明暗変化なし）
      .to(
        overlay,
        {
          y: 3,
          rotation: -0.3,
          duration: 3.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=0.1"
      )
      .to(
        text,
        {
          y: 1,
          duration: 3.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=3.5"
      )

      // Phase 8: 控えめな痙攣的な動き（失敗の余韻）
      .to(
        overlay,
        {
          x: () => gsap.utils.random(-2, 2),
          scale: () => gsap.utils.random(0.99, 1.01),
          duration: 0.12,
          ease: "power2.out",
          repeat: 1,
          yoyo: true,
          repeatDelay: 6, // 6秒ごとに控えめな痙攣
        },
        4 // 4秒後から開始
      )
      .to(
        text,
        {
          x: () => gsap.utils.random(-1, 1),
          duration: 0.12,
          ease: "power2.out",
          repeat: 1,
          yoyo: true,
          repeatDelay: 6,
        },
        4
      );
    } else {
      // ドラクエ風爆発演出！ + オクトパストラベラーBOOST風！

      // 勝利時の初期位置設定（中央に固定）
      gsap.set(container, {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 1, // 勝利時は即座に表示
      });

      // ====================================================
      // BOOST Phase 0: ホワイトフラッシュ（衝撃的開幕）
      // ====================================================
      if (flashNode) {
        tl.fromTo(
          flashNode,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.06,
            ease: "power4.in",
          }
        )
        .to(flashNode, {
          opacity: 0,
          duration: 0.23,
          ease: "power2.out"
        });
      }
      tl.call(() => triggerBackgroundFx("lightSweep"), undefined, "<");

      // ====================================================
      // BOOST Phase 0.5: 放射状ライン爆発（3段階！）
      // LEFT → RIGHT → CENTER！！
      // ====================================================
      if (pixiRaysReady) {
        // Pixi 版（デフォルト）
        tl.call(() => {
          pixiRaysController?.playExplosion();
        }, undefined, 0.05);
      } else if (useSvgRays) {
        // SVG 版（フォールバック）
        (lineNodesSnapshot ?? []).forEach((line) => {
          if (line) {
            gsap.set(line, {
              transformOrigin: "0% 50%",
              transformBox: "fill-box",
            });
          }
        });

        // 【第1波】LEFT から爆発（0.05s）
        [0, 1, 7].forEach((index) => {
          const line = lineNodesSnapshot?.[index];
          if (!line) return;
          tl.fromTo(
            line,
            { scaleX: 0, opacity: 1 },
            {
              scaleX: 4.6,
              opacity: 0,
              duration: 0.58,
              ease: "power3.out",
            },
            0.05
          );
        });

        // 【第2波】RIGHT から爆発（0.15s）
        [3, 4, 5].forEach((index) => {
          const line = lineNodesSnapshot?.[index];
          if (!line) return;
          tl.fromTo(
            line,
            { scaleX: 0, opacity: 1 },
            {
              scaleX: 4.6,
              opacity: 0,
              duration: 0.58,
              ease: "power3.out",
            },
            0.15
          );
        });

        // 【第3波】CENTER（上下）から爆発（0.25s）
        [2, 6].forEach((index) => {
          const line = lineNodesSnapshot?.[index];
          if (!line) return;
          tl.fromTo(
            line,
            { scaleX: 0, opacity: 1 },
            {
              scaleX: 5.4,
              opacity: 0,
              duration: 0.83,
              ease: "power4.out",
            },
            0.25
          );
        });
      } else {
        // Pixi 初期化待ち中は放射線なしで継続
      }

      // ====================================================
      // BOOST Phase 0.7: コンテナシェイク（衝撃波）
      // ====================================================
      tl.to(
        container,
        {
          x: 8,
          duration: 0.04,
          repeat: 8,
          yoyo: true,
          ease: "power1.inOut",
        },
        0.1
      )
      // シェイク後、確実に中央に戻す（xPercent維持）
      .to(
        container,
        {
          x: 0,
          y: 0,
          rotation: 0,
          duration: 0.11,
          ease: "power2.out",
        }
      );

      // ====================================================
      // Phase 1: 画面左外から超高速で飛んでくる！！
      // ====================================================
      tl.fromTo(
        overlay,
        {
          x: () => -window.innerWidth * 1.45 - 800, // 画面左外さらに遠くから突入
          opacity: 0,
          scale: 0.38,
          rotation: -28,
          skewX: -9,
          filter: "blur(26px) brightness(5.2)", // 超明るくブレながら
        },
        {
          x: 0, // 中央に到着！
          opacity: 1,
          scale: 1.35,
          rotation: 7, // 少し回転しながら
          skewX: 0,
          filter: "blur(0px) brightness(1.55)",
          duration: 0.46, // 滑空を少し長く
          ease: "power3.out",
        },
        0.12 // ライン爆発より一瞬早く突入開始
      )
      // 到着時の反動（ビシッ！）
      .to(overlay, {
        scale: 1.1,
        rotation: 0,
        filter: "brightness(1.3)",
        duration: 0.17, // 0.2 → 0.15 → 0.17 に微調整！
        ease: "back.out(3)",
      })

      // Phase 2: 強烈なバウンス（ドラクエのレベルアップ感）
      .to(overlay, {
        scale: 0.8,
        duration: 0.13,
        ease: "power4.in"
      })
      .to(overlay, {
        scale: 1.4,
        rotation: 3,
        duration: 0.27,
        ease: "elastic.out(1.8, 0.3)"
      })
      .to(overlay, {
        scale: 0.95,
        rotation: -2,
        duration: 0.14,
        ease: "power3.in"
      })
      .to(overlay, {
        scale: 1.15,
        rotation: 1,
        duration: 0.19,
        ease: "back.out(2)",
        filter: "brightness(1.5) saturate(1.3)"
      })

      // Phase 3: テキスト躍動（枠とほぼ同時に登場！）
      .fromTo(
        text,
        {
          opacity: 0,
          y: 30,
          scale: 0.8,
          rotationX: 30,
          filter: "blur(8px) brightness(5)" // 明るくスタート
        },
        {
          opacity: 1,
          y: 0,
          scale: 1.1,
          rotationX: 0,
          filter: "blur(0px) brightness(1)",
          duration: 0.37, // 0.45 → 0.35 → 0.37 に微調整！
          ease: "back.out(2.5)",
          onStart: () => {
            const currentSettings = soundManager?.getSettings();
            const successMode = currentSettings?.successMode ?? "normal";
            if (successMode === "normal") {
              playSuccessNormal();
            }
          },
        },
        0.5 // "-=0.4" → 0.5 に変更（枠到着とほぼ同時）
      )
      .call(() => triggerBackgroundFx("fireworks"), undefined, ">")

      // Phase 4: 派手な跳ね演出 + 黄金演出の連動
      .to(text, {
        y: -12,
        scale: 1.25,
        rotation: -1,
        duration: 0.31,
        ease: "power2.out"
      })
      // 輝きの予兆（テキストが頂点に達した時）
      .to(overlay, {
        boxShadow: "0 0 8px rgba(255,255,255,0.4), inset 0 0 5px rgba(255,255,255,0.1)",
        duration: 0.14,
        ease: "power1.out"
      }, "-=0.14")

      .to(text, {
        y: 8,
        scale: 0.9,
        rotation: 1,
        duration: 0.21,
        ease: "power2.in"
      })
      // 薄い金色（テキストが下に弾む時）
      .to(overlay, {
        boxShadow: "0 0 15px rgba(255,235,100,0.6), 0 0 30px rgba(255,235,100,0.3), inset 0 0 8px rgba(255,255,255,0.2)",
        duration: 0.21,
        ease: "power2.out"
      }, "-=0.21")

      .to(text, {
        y: -5,
        scale: 1.05,
        rotation: 0,
        duration: 0.38,
        ease: "elastic.out(1.5, 0.4)",
      })
      // 濃い黄金（テキストがエラスティックで弾む時）
      .to(overlay, {
        boxShadow: "0 0 22px rgba(255,215,0,0.8), 0 0 45px rgba(255,215,0,0.4), inset 0 0 12px rgba(255,255,255,0.3)",
        duration: 0.38,
        ease: "elastic.out(1.5, 0.4)"
      }, "-=0.38")

      // Phase 6: 最終安定 + 永続浮遊
      .to(overlay, {
        scale: 1.08,
        rotation: 0,
        filter: "brightness(1.2)",
        boxShadow: "0 0 15px rgba(255,215,0,0.6), inset 0 0 8px rgba(255,255,255,0.2)",
        duration: 0.43,
        ease: "power3.out"
      })
      .to(text, {
        y: 0,
        scale: 1,
        duration: 0.32,
        ease: "elastic.out(1.3, 0.5)"
      }, "-=0.2")
      // containerを完全に中央にリセット（念押し・xPercentは維持）
      .to(container, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: 0.19,
        ease: "power2.out"
      }, "-=0.19")

      // Phase 7: 自然な永続浮遊（呼吸のような）
      .to(
        overlay,
        {
          y: -6,
          rotationZ: 0.7,
          scale: 1.03,
          duration: 3.2, // より自然な呼吸周期
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=0.1"
      )
      .to(
        text,
        {
          y: -2,
          rotationZ: -0.3,
          duration: 3.4, // 少しズレたタイミング
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=3.1" // 微妙にずらして自然さを演出
      )

      // Phase 8: 黄金の呼吸（輝きのゆらぎ）
      .to(
        overlay,
        {
          boxShadow: "0 0 18px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3), inset 0 0 10px rgba(255,255,255,0.2)",
          duration: 2.8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=3.2"
      )

      // パーティクル風演出（キラキラ）
      .set({}, {}, 0) // パーティクル用のプレースホルダー
      ;
    }

    // Timeline を再生
    tl.restart();

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
      // より確実なクリーンアップ
      if (overlay) {
        gsap.set(overlay, { clearProps: "all" });
      }
      if (text) {
        gsap.set(text, { clearProps: "all" });
      }
      if (flashNode) {
        gsap.set(flashNode, { clearProps: "all" });
      }
      if (container) {
        // 中央位置は保持しつつ、アニメーションプロパティのみクリア
        gsap.set(container, {
          xPercent: -50,
          yPercent: -50,
          x: 0,
          y: 0,
          rotation: 0,
        });
      }
      // SVG 版のクリーンアップ
      if (lineNodesSnapshot) {
        lineNodesSnapshot.forEach((line) => {
          if (line) {
            gsap.set(line, { clearProps: "all" });
          }
        });
      }
    };
  }, [
    failed,
    mode,
    prefersReduced,
    triggerBackgroundFx,
    pixiRaysController,
    pixiRaysReady,
    playFailure,
    playSuccessNormal,
    soundManager,
    timeline,
    useSvgRays,
    linesRef,
  ]);

  const title = failed ? FAILURE_TITLE : VICTORY_TITLE;
  const subtext = failed ? FAILURE_SUBTEXT : VICTORY_SUBTEXT;

  if (mode === "inline") {
    return (
      <Box
        color="white"
        letterSpacing={0.5}
        whiteSpace="nowrap"
        fontFamily="monospace"
        textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        bg={UI_TOKENS.COLORS.panelBg80}
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        px={4}
        py={2}
        fontWeight={700}
      >
        {title}
      </Box>
    );
  }

  return (
    <>
      {mode === "overlay" && (
        <>
          <Box
            ref={flashRef}
            position="fixed"
            inset={0}
            bg="white"
            opacity={0}
            pointerEvents="none"
            zIndex={9999}
          />
          {useSvgRays && <VictoryBurstRaysSVG registerRayRef={registerLineRef} />}
        </>
      )}

      <Box
        ref={containerRef}
        position="absolute"
        top="50%"
        left="50%"
        zIndex={10}
        // 初期ペイント時のチラ見え防止（右下に一瞬出ないよう中央原点＆非表示）
        transform="translate(-50%, -50%)"
        opacity={0}
        pointerEvents="none"
      >
        <Box
          ref={overlayRef}
          px={{ base: 6, md: 8 }}
          py={{ base: 4, md: 5 }}
          borderRadius={0}
          fontWeight={800}
          fontSize={{ base: "22px", md: "28px" }}
          color="white"
          letterSpacing={1}
          border="3px solid"
          borderColor={UI_TOKENS.COLORS.whiteAlpha90}
          css={{
            background: UI_TOKENS.COLORS.panelBg,
            boxShadow:
              "3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.6), inset 1px 1px 0 rgba(255,255,255,0.1)",
          }}
          // 初期は非表示（GSAPで表示を制御）
          opacity={0}
        >
          <Box ref={textRef} textAlign="center">
            {title}
            <Text
              fontSize={{ base: "15px", md: "17px" }}
              mt={2}
              opacity={0.9}
              fontFamily="monospace"
              fontWeight={500}
              letterSpacing="0.5px"
              textShadow="1px 1px 0px #000"
            >
              {subtext}
            </Text>
          </Box>
        </Box>
      </Box>
    </>
  );
}
