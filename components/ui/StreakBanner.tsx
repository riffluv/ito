"use client";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { Box, HStack, Portal, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { gsap } from "gsap";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

// ============================================================
// HD-2D × 据え置きゲーム "ご褒美カットイン" StreakBanner
// ============================================================
// v2: チラシ感を排除、据え置きゲームのカットイン演出に特化
// - 盾形クリップ → シンプルな横ライン＋数字の大胆な演出
// - フレーバーテキスト削除 → 数字とラベルのみ
// - 位置を上部に（勝利オーバーレイと被らない）
// - 登場/退場をドラマチックに（画面端からのスライド＋光）
// ============================================================

interface StreakBannerProps {
  streak: number;
  isVisible: boolean;
  onComplete?: () => void;
}

// 光の筋アニメーション
const lightSweep = keyframes`
  0% { transform: translateX(-200%) skewX(-25deg); opacity: 0; }
  10% { opacity: 0.9; }
  100% { transform: translateX(400%) skewX(-25deg); opacity: 0; }
`;

// 数字の輝きパルス
const numberPulse = keyframes`
  0%, 100% { filter: brightness(1) drop-shadow(0 0 8px currentColor); }
  50% { filter: brightness(1.3) drop-shadow(0 0 18px currentColor); }
`;

export function StreakBanner({
  streak,
  isVisible,
  onComplete,
}: StreakBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const lineLeftRef = useRef<HTMLDivElement>(null);
  const lineRightRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotionPreference();
  const onCompleteRef = useRef(onComplete);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const prevVisibleRef = useRef(false);

  const streakLevel = useMemo(() => {
    if (streak >= 10) return "legend";
    if (streak >= 5) return "great";
    return "normal";
  }, [streak]);

  // レベル別スタイル（よりシンプルに）
  const config = useMemo(() => {
    switch (streakLevel) {
      case "legend":
        return {
          // 青白プラチナ - 神聖な輝き
          numberColor: "#E8F4FF",
          labelColor: "#B8D4FF",
          lineColor: "rgba(180, 210, 255, 0.85)",
          glowColor: "rgba(150, 200, 255, 0.6)",
          bgGlow:
            "radial-gradient(ellipse at center, rgba(100,150,255,0.25) 0%, transparent 70%)",
          numberSize: { base: "82px", md: "110px" },
          labelSize: { base: "15px", md: "18px" },
          holdDuration: 2.2,
          intensity: 1.3,
        };
      case "great":
        return {
          // 明るい黄金
          numberColor: "#FFE566",
          labelColor: "#FFD040",
          lineColor: "rgba(255, 200, 80, 0.8)",
          glowColor: "rgba(255, 180, 60, 0.5)",
          bgGlow:
            "radial-gradient(ellipse at center, rgba(255,180,60,0.2) 0%, transparent 70%)",
          numberSize: { base: "72px", md: "96px" },
          labelSize: { base: "14px", md: "17px" },
          holdDuration: 1.9,
          intensity: 1.15,
        };
      default:
        return {
          // 温かい黄金（控えめ）
          numberColor: "#FFD700",
          labelColor: "#E8C040",
          lineColor: "rgba(255, 200, 80, 0.7)",
          glowColor: "rgba(255, 180, 60, 0.35)",
          bgGlow:
            "radial-gradient(ellipse at center, rgba(255,180,60,0.12) 0%, transparent 70%)",
          numberSize: { base: "64px", md: "84px" },
          labelSize: { base: "13px", md: "16px" },
          holdDuration: 1.6,
          intensity: 1.0,
        };
    }
  }, [streakLevel]);

  const runAnimation = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const number = numberRef.current;
    const label = labelRef.current;
    const lineLeft = lineLeftRef.current;
    const lineRight = lineRightRef.current;
    const glow = glowRef.current;

    if (
      !container ||
      !content ||
      !number ||
      !label ||
      !lineLeft ||
      !lineRight
    ) {
      return null;
    }

    gsap.set([container, content, number, label, lineLeft, lineRight], {
      force3D: true,
    });

    const tl = gsap.timeline({
      onComplete: () => {
        onCompleteRef.current?.();
      },
    });

    if (prefersReduced) {
      gsap.set(container, { autoAlpha: 0 });
      gsap.set(content, { opacity: 1, scale: 1 });
      gsap.set([number, label], { opacity: 1 });
      gsap.set([lineLeft, lineRight], { scaleX: 1, opacity: 1 });

      tl.to(container, { autoAlpha: 1, duration: 0.3, ease: "power2.out" })
        .to({}, { duration: config.holdDuration })
        .to(container, { autoAlpha: 0, duration: 0.3, ease: "power2.in" });

      return tl;
    }

    // ============================================================
    // 据え置きゲーム風カットイン演出
    // ============================================================

    // 初期状態: 完全に隠す
    gsap.set(container, { autoAlpha: 0 });
    gsap.set(content, { opacity: 0, scale: 0.6 });
    gsap.set(number, { opacity: 0, scale: 2.5, y: 30, rotationX: -40 });
    gsap.set(label, { opacity: 0, y: 20, letterSpacing: "0.8em" });
    gsap.set(lineLeft, { scaleX: 0, transformOrigin: "right center" });
    gsap.set(lineRight, { scaleX: 0, transformOrigin: "left center" });
    if (glow) gsap.set(glow, { opacity: 0, scale: 0.5 });

    // ============================================================
    // Phase 1: 衝撃的な登場（画面がフラッシュ＆数字がドン！）
    // ============================================================

    tl.set(container, { autoAlpha: 1 });

    // グロー出現
    if (glow) {
      tl.to(
        glow,
        {
          opacity: 1,
          scale: config.intensity,
          duration: 0.15,
          ease: "power2.out",
        },
        0
      );
    }

    // コンテンツ全体の登場
    tl.to(
      content,
      {
        opacity: 1,
        scale: 1,
        duration: 0.25,
        ease: "power3.out",
      },
      0.05
    );

    // 数字: 奥から手前にドン！と飛び出す
    tl.to(
      number,
      {
        opacity: 1,
        scale: config.intensity * 1.2,
        y: -5,
        rotationX: 0,
        duration: 0.32,
        ease: "back.out(2.5)",
      },
      0.08
    ).to(number, {
      scale: config.intensity,
      y: 0,
      duration: 0.18,
      ease: "power2.out",
    });

    // 左右のライン: 中央から外側へ走る
    tl.to(
      lineLeft,
      {
        scaleX: 1,
        duration: 0.35,
        ease: "power3.out",
      },
      0.15
    ).to(
      lineRight,
      {
        scaleX: 1,
        duration: 0.35,
        ease: "power3.out",
      },
      0.15
    );

    // ラベル: 字間が縮まりながら登場
    tl.to(
      label,
      {
        opacity: 1,
        y: 0,
        letterSpacing: "0.35em",
        duration: 0.4,
        ease: "power2.out",
      },
      0.25
    );

    // ============================================================
    // Phase 2: インパクト（数字のパルス＋シェイク）
    // ============================================================

    if (streakLevel === "legend" || streakLevel === "great") {
      // 数字パルス
      tl.to(number, {
        scale: config.intensity * 1.15,
        duration: 0.12,
        ease: "power2.out",
      }).to(number, {
        scale: config.intensity,
        duration: 0.1,
        ease: "power2.in",
      });

      // legend時はシェイク追加
      if (streakLevel === "legend") {
        tl.to(content, {
          x: 8,
          duration: 0.035,
          repeat: 5,
          yoyo: true,
          ease: "power1.inOut",
        }).to(content, {
          x: 0,
          duration: 0.1,
          ease: "power2.out",
        });
      }
    }

    // ============================================================
    // Phase 3: ホールド（軽い浮遊感）
    // ============================================================

    tl.to(
      content,
      {
        y: -3,
        duration: config.holdDuration * 0.45,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 1,
      },
      "-=0.05"
    );

    // グローの呼吸
    if (glow) {
      tl.to(
        glow,
        {
          scale: config.intensity * 1.1,
          opacity: 0.8,
          duration: config.holdDuration * 0.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 1,
        },
        `-=${config.holdDuration * 0.9}`
      );
    }

    // ============================================================
    // Phase 4: 退場（光に包まれて上へ消える）
    // ============================================================

    // コンテナ全体を上に移動しながらフェードアウト
    // exit 開始時に必ず可視のままスタートさせ、位置も 0 から保証する
    tl.addLabel("exit");

    tl.to(
      [lineLeft, lineRight],
      {
        scaleX: 0,
        duration: 0.25,
        ease: "power2.in",
      },
      "exit"
    );

    tl.fromTo(
      container,
      {
        y: 0,
        autoAlpha: 1,
        scale: 1,
        filter: "brightness(1)",
      },
      {
        y: -50,
        autoAlpha: 0,
        scale: 0.95,
        filter: "brightness(1.5)",
        duration: 0.45,
        ease: "power2.in",
      },
      "exit"
    );

    return tl;
  }, [config, prefersReduced, streakLevel]);

  // Keep initial visibility under GSAP control to avoid React re-renders briefly
  // resetting inline styles (flicker) just before the exit tween starts.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const glow = glowRef.current;

    if (!container || !content) {
      return () => {};
    }

    gsap.set(container, {
      autoAlpha: 0,
      y: 0,
      scale: 1,
      filter: "brightness(1)",
      willChange: "transform, opacity, filter",
    });
    gsap.set(content, { opacity: 0, scale: 0.6, y: 0 });
    if (glow) gsap.set(glow, { opacity: 0, scale: 0.5 });

    return () => {
      gsap.set(container, {
        clearProps: "opacity,visibility,transform,filter,willChange",
      });
      gsap.set(content, { clearProps: "opacity,transform" });
      if (glow) gsap.set(glow, { clearProps: "opacity,transform" });
    };
  }, []);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = isVisible;

    if (!isVisible || streak < 2) {
      return undefined;
    }

    if (wasVisible) {
      return undefined;
    }

    const tl = runAnimation();
    if (tl) {
      tlRef.current = tl;
    }

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
    };
  }, [isVisible, streak, runAnimation]);

  if (!isVisible || streak < 2) return null;

  return (
    <Portal>
      <Box
        ref={containerRef}
        position="fixed"
        top={{ base: "18%", md: "20%" }}
        left="50%"
        transform="translateX(-50%)"
        zIndex={10001}
        pointerEvents="none"
      >
        {/* 背景グロー */}
        <Box
          ref={glowRef}
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          w={{ base: "280px", md: "400px" }}
          h={{ base: "140px", md: "200px" }}
          bg={config.bgGlow}
          borderRadius="50%"
          filter="blur(30px)"
          pointerEvents="none"
        />

        {/* メインコンテンツ */}
        <Box
          ref={contentRef}
          position="relative"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
        >
          {/* 数字＋ラベル - 中央揃え */}
          <HStack gap={{ base: 2, md: 3 }} align="baseline" justify="center">
            {/* 連勝数 */}
            <Box ref={numberRef} position="relative">
              <Text
                fontSize={config.numberSize}
                fontWeight={900}
                color={config.numberColor}
                textShadow={`
                  0 4px 0 rgba(0,0,0,0.95),
                  0 0 30px ${config.glowColor},
                  0 0 60px ${config.glowColor}
                `}
                lineHeight="1"
                fontFamily="monospace"
                letterSpacing="-0.03em"
                animation={
                  !prefersReduced
                    ? `${numberPulse} 2.5s ease-in-out infinite`
                    : undefined
                }
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {streak}
              </Text>

              {/* 光の筋エフェクト */}
              <Box
                position="absolute"
                inset={0}
                overflow="hidden"
                pointerEvents="none"
              >
                <Box
                  position="absolute"
                  top="-20%"
                  left="-50%"
                  w="50%"
                  h="140%"
                  bg="linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)"
                  animation={
                    !prefersReduced
                      ? `${lightSweep} 3s ease-in-out infinite`
                      : undefined
                  }
                  animationDelay="0.8s"
                />
              </Box>
            </Box>

            {/* 連勝ラベル */}
            <Box ref={labelRef}>
              <Text
                fontSize={config.labelSize}
                fontWeight={700}
                color={config.labelColor}
                textShadow={`
                  0 2px 0 rgba(0,0,0,0.9),
                  0 0 15px ${config.glowColor}
                `}
                letterSpacing="0.35em"
                fontFamily="monospace"
                textTransform="uppercase"
              >
                WINS
              </Text>
            </Box>
          </HStack>

          {/* 左右のライン装飾 - 中央を基準に配置 */}
          <Box
            position="absolute"
            top="50%"
            left="50%"
            w={{ base: "320px", md: "480px" }}
            transform="translate(-50%, -50%)"
            display="flex"
            justifyContent="space-between"
            pointerEvents="none"
          >
            {/* 左ライン */}
            <Box
              ref={lineLeftRef}
              w={{ base: "90px", md: "140px" }}
              h="2px"
              bg={`linear-gradient(to left, ${config.lineColor}, transparent)`}
              boxShadow={`0 0 12px ${config.glowColor}`}
              transformOrigin="right center"
            />
            {/* 右ライン */}
            <Box
              ref={lineRightRef}
              w={{ base: "90px", md: "140px" }}
              h="2px"
              bg={`linear-gradient(to right, ${config.lineColor}, transparent)`}
              boxShadow={`0 0 12px ${config.glowColor}`}
              transformOrigin="left center"
            />
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
