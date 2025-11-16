"use client";

import { Box, Flex, Text, Portal } from "@chakra-ui/react";
import { gsap } from "gsap";
import { useEffect, useRef, useMemo } from "react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

interface StreakBannerProps {
  streak: number;
  isVisible: boolean;
  onComplete?: () => void;
}

export function StreakBanner({ streak, isVisible, onComplete }: StreakBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotionPreference();

  // 前回のisVisibleを記憶（2重起動防止）
  const prevVisibleRef = useRef(false);

  // Streak レベルの判定
  const streakLevel = useMemo(() => {
    if (streak >= 10) return "legend"; // 10連勝以上
    if (streak >= 5) return "great";   // 5〜9連勝
    return "normal";                    // 2〜4連勝
  }, [streak]);

  const config = useMemo(() => {
    switch (streakLevel) {
      case "legend":
        return {
          label: "LEGENDARY STREAK!!",
          numberColor: "#E0E7FF", // プラチナホワイト
          labelColor: "#C7D2FE",
          borderColor: "rgba(224,231,255,0.92)",
          glowColor: "rgba(224,231,255,0.8)",
          shadowColor: "rgba(99,102,241,0.6)",
          fontSize: { base: "68px", md: "76px" },
          labelSize: { base: "36px", md: "42px" },
          scale: 1.15,
          particles: true,
          rays: true,
        };
      case "great":
        return {
          label: "EPIC STREAK!!",
          numberColor: "#FDE68A", // ゴールドより明るい
          labelColor: "#FCD34D",
          borderColor: "rgba(253,230,138,0.88)",
          glowColor: "rgba(253,230,138,0.7)",
          shadowColor: "rgba(245,158,11,0.5)",
          fontSize: { base: "62px", md: "68px" },
          labelSize: { base: "34px", md: "38px" },
          scale: 1.08,
          particles: true,
          rays: false,
        };
      default:
        return {
          label: "STREAK!!",
          numberColor: "#FFD700", // ゴールド
          labelColor: "rgba(255,215,0,0.92)",
          borderColor: "rgba(255,215,0,0.88)",
          glowColor: "rgba(255,215,0,0.5)",
          shadowColor: "rgba(255,215,0,0.4)",
          fontSize: { base: "56px", md: "60px" },
          labelSize: { base: "32px", md: "36px" },
          scale: 1,
          particles: false,
          rays: false,
        };
    }
  }, [streakLevel]);

  useEffect(() => {
    // isVisibleがfalse→trueになった時だけアニメーション開始（2重起動防止）
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = isVisible;

    if (!isVisible || streak < 2) {
      return undefined;
    }

    // 既に表示中なら何もしない（2重起動防止）
    if (wasVisible) {
      return undefined;
    }

    const banner = bannerRef.current;
    const number = numberRef.current;
    if (!banner || !number) {
      return undefined;
    }

    // GPU加速
    gsap.set(banner, { force3D: true });
    gsap.set(number, { force3D: true });

    const tl = gsap.timeline({
      onComplete: () => {
        onComplete?.();
      },
    });

    if (prefersReduced) {
      // 低モーションでも上方向フェードアウトを行う（移動は最小限）
      gsap.set(banner, { opacity: 1, x: 0, y: 0, rotation: 0, scale: 1 });
      gsap.set(number, { scale: 1 });
      tl
        .to({}, { duration: 1.6 }) // 短いホールド
        .to(banner, {
          y: -55,
          opacity: 0,
          duration: 0.42,
          ease: "power2.in",
        });
    } else {
      // 初期状態
      gsap.set(banner, {
        x: 320,
        y: -15,
        opacity: 0,
        scale: 0.65,
        rotation: 10,
      });

      // アニメーション
      tl
        // 横からスライドイン + 回転で登場
        .to(banner, {
          x: 0,
          y: 0,
          opacity: 1,
          scale: config.scale,
          rotation: 0,
          duration: 0.58,
          ease: "back.out(1.9)",
        })
        // 数字だけパルス（1回目）
        .to(number, {
          scale: 1.18,
          duration: 0.19,
          ease: "power2.out",
        })
        .to(number, {
          scale: 1,
          duration: 0.16,
          ease: "power2.in",
        });

      // 特別演出: 5連勝以上なら追加パルス
      if (streakLevel === "great" || streakLevel === "legend") {
        tl
          .to(number, {
            scale: 1.12,
            duration: 0.15,
            ease: "power2.out",
          }, "+=0.1")
          .to(number, {
            scale: 1,
            duration: 0.13,
            ease: "power2.in",
          });
      }

      // 10連勝はさらに激しく
      if (streakLevel === "legend") {
        tl
          .to(banner, {
            rotation: -1.5,
            duration: 0.25,
            ease: "sine.inOut",
          }, "-=0.2")
          .to(banner, {
            rotation: 0,
            duration: 0.25,
            ease: "sine.inOut",
          });
      }

      // 表示維持
      tl.to({}, { duration: streakLevel === "legend" ? 1.5 : 1.3 });

      // フェードアウト（上にスライド）
      tl
        .to(banner, {
          y: -55,
          opacity: 0,
          scale: config.scale * 0.92,
          duration: 0.42,
          ease: "power2.in",
        });
    }

    return () => {
      tl.kill();
    };
  }, [isVisible, streak, config, onComplete, prefersReduced, streakLevel]);

  if (!isVisible || streak < 2) return null;

  return (
    <Portal>
      <Box
        ref={bannerRef}
        position="fixed"
        top={{ base: "22%", md: "24%" }}
        left="50%"
        transform="translateX(-50%)"
        zIndex={10001}
        pointerEvents="none"
      >
        <Box
          position="relative"
          px={{ base: "19px", md: "26px" }}
          py={{ base: "13px", md: "17px" }}
          bg="rgba(8,6,14,0.96)"
          border={`3px solid ${config.borderColor}`}
          borderRadius="0"
          boxShadow={`0 0 ${streakLevel === "legend" ? "32px" : streakLevel === "great" ? "26px" : "22px"} ${config.glowColor}, inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.55)`}
          _before={{
            content: '""',
            position: "absolute",
            inset: "3px",
            border: `2px solid ${config.borderColor}`,
            opacity: 0.5,
            pointerEvents: "none",
          }}
          // 10連勝は背景にも特別感
          _after={streakLevel === "legend" ? {
            content: '""',
            position: "absolute",
            inset: "-6px",
            border: "1px solid rgba(224,231,255,0.35)",
            pointerEvents: "none",
          } : undefined}
        >
          <Flex align="baseline" gap={{ base: "11px", md: "15px" }} justify="center">
            {/* 数字 */}
            <Box ref={numberRef}>
              <Text
                fontSize={config.fontSize}
                fontWeight={900}
                color={config.numberColor}
                textShadow={`
                  3px 3px 0 rgba(0,0,0,0.92),
                  0 0 ${streakLevel === "legend" ? "28px" : streakLevel === "great" ? "22px" : "18px"} ${config.glowColor},
                  ${streakLevel === "legend" ? "0 0 48px " + config.shadowColor : ""}
                `}
                lineHeight="1"
                fontFamily="monospace"
                letterSpacing="-0.02em"
              >
                {streak}
              </Text>
            </Box>

            {/* ラベル */}
            <Text
              fontSize={config.labelSize}
              fontWeight={700}
              letterSpacing="0.18em"
              color={config.labelColor}
              textShadow={`2px 2px 0 rgba(0,0,0,0.85), 0 0 12px ${config.shadowColor}`}
              lineHeight="1"
              fontFamily="monospace"
              pt={{ base: "7px", md: "9px" }}
            >
              {config.label}
            </Text>
          </Flex>
        </Box>
      </Box>
    </Portal>
  );
}
