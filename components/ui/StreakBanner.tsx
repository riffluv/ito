"use client";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { Box, HStack, Portal, Text } from "@chakra-ui/react";
import { useMemo, useRef } from "react";
import { lightSweep, numberPulse } from "@/components/ui/streak-banner/streakBannerKeyframes";
import {
  getStreakBannerConfig,
  getStreakLevel,
} from "@/components/ui/streak-banner/streakBannerConfig";
import { useStreakBannerAnimation } from "@/components/ui/streak-banner/useStreakBannerAnimation";

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

  const streakLevel = useMemo(() => {
    return getStreakLevel(streak);
  }, [streak]);

  // レベル別スタイル（よりシンプルに）
  const config = useMemo(() => {
    return getStreakBannerConfig(streakLevel);
  }, [streakLevel]);

  useStreakBannerAnimation({
    streak,
    isVisible,
    streakLevel,
    config,
    prefersReduced,
    onComplete,
    containerRef,
    contentRef,
    numberRef,
    labelRef,
    lineLeftRef,
    lineRightRef,
    glowRef,
  });

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
