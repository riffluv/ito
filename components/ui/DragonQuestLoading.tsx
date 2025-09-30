"use client";

import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  DEFAULT_LOADING_STEPS,
  TransitionLoadingStep,
} from "@/hooks/usePageTransition";

interface DragonQuestLoadingProps {
  isVisible: boolean;
  currentStep?: string;
  progress?: number; // 0-100
  steps?: TransitionLoadingStep[];
  customMessage?: string;
  onComplete?: () => void;
}

const STEP_ICON_FALLBACK: Record<string, string> = {
  firebase: "🔥",
  room: "⚔️",
  player: "👥",
  ready: "🎮",
  operation: "⚙️",
  complete: "✅",
  save: "💾",
  apply: "✨",
};

export function DragonQuestLoading({
  isVisible,
  currentStep = "firebase",
  progress = 0,
  steps,
  customMessage,
  onComplete,
}: DragonQuestLoadingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dot1Ref = useRef<HTMLDivElement>(null);
  const dot2Ref = useRef<HTMLDivElement>(null);
  const dot3Ref = useRef<HTMLDivElement>(null);
  const [furthestStepIndex, setFurthestStepIndex] = useState(-1);

  const resolvedSteps = useMemo<TransitionLoadingStep[]>(() => {
    if (steps && steps.length > 0) return steps;
    return DEFAULT_LOADING_STEPS;
  }, [steps]);

  const currentIndex = useMemo(() => {
    const index = resolvedSteps.findIndex(step => step.id === currentStep);
    if (index >= 0) return index;
    if (progress >= 100) return resolvedSteps.length - 1;
    return resolvedSteps.length > 0 ? 0 : -1;
  }, [resolvedSteps, currentStep, progress]);

  // 画面のスクロール制御とGSAPフェードイン
  useEffect(() => {
    const container = containerRef.current;

    if (!isVisible) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    if (!container) return;

    // 純粋なGSAP制御に統一
    gsap.set(container, { opacity: 0 });
    gsap.to(container, {
      opacity: 1,
      duration: 0.2,
      ease: "none",
    });

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      gsap.killTweensOf(container);
    };
  }, [isVisible]);

  // プログレスバーアニメーション - 純粋なGSAP制御
  useEffect(() => {
    const bar = progressBarRef.current;
    if (!bar) return;

    const clamped = Math.min(Math.max(progress, 0), 100);

    gsap.to(bar, {
      width: `${clamped}%`,
      duration: 0.35,
      ease: "power1.out",
      overwrite: "auto",
    });

    return () => {
      gsap.killTweensOf(bar);
    };
  }, [progress]);

  // ステップ進行を記録してハイライト制御
  useEffect(() => {
    if (!isVisible) {
      setFurthestStepIndex(-1);
      return;
    }
    setFurthestStepIndex(prev => Math.max(prev, currentIndex));
  }, [currentIndex, isVisible]);

  useEffect(() => {
    if (!isVisible) {
      setFurthestStepIndex(-1);
    }
  }, [isVisible]);

  // パルス・シマー・ドットアニメーション - 純粋なGSAP制御
  useEffect(() => {
    if (!isVisible) return;

    const box = boxRef.current;
    const bar = progressBarRef.current;
    const dot1 = dot1Ref.current;
    const dot2 = dot2Ref.current;
    const dot3 = dot3Ref.current;

    // ボックスのパルス効果
    if (box) {
      gsap.to(box, {
        boxShadow: "inset 2px 2px 0 #ffffff, inset -2px -2px 0 #333333, 0 0 30px rgba(255,255,255,0.25)",
        duration: 1,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }

    // プログレスバーのシマー効果
    if (bar) {
      gsap.to(bar, {
        filter: "brightness(1.2)",
        duration: 0.75,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }

    // ドット1
    if (dot1) {
      gsap.to(dot1, {
        opacity: 1,
        scale: 1.2,
        duration: 0.47,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: false,
        repeatDelay: 0.93,
      });
    }

    // ドット2（0.47秒遅延）
    if (dot2) {
      gsap.to(dot2, {
        opacity: 1,
        scale: 1.2,
        duration: 0.47,
        ease: "sine.inOut",
        delay: 0.47,
        repeat: -1,
        yoyo: false,
        repeatDelay: 0.93,
      });
    }

    // ドット3（0.93秒遅延）
    if (dot3) {
      gsap.to(dot3, {
        opacity: 1,
        scale: 1.2,
        duration: 0.47,
        ease: "sine.inOut",
        delay: 0.93,
        repeat: -1,
        yoyo: false,
        repeatDelay: 0.93,
      });
    }

    return () => {
      if (box) gsap.killTweensOf(box);
      if (bar) gsap.killTweensOf(bar);
      if (dot1) gsap.killTweensOf(dot1);
      if (dot2) gsap.killTweensOf(dot2);
      if (dot3) gsap.killTweensOf(dot3);
    };
  }, [isVisible]);

  // 完了時のフェードアウト - 純粋なGSAP制御
  useEffect(() => {
    if (!isVisible || !onComplete) return;
    if (progress < 100) return;

    const timer = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) {
        onComplete();
        return;
      }

      // ドラクエ風：すっきり消える
      gsap.to(container, {
        opacity: 0,
        duration: 0.3,
        ease: "none",
        onComplete,
        overwrite: "auto",
      });
    }, 300); // ドラクエ風：キビキビした反応

    return () => {
      window.clearTimeout(timer);
    };
  }, [progress, isVisible, onComplete]);

  if (!isVisible) return null;

  const activeIndex = Math.max(furthestStepIndex, currentIndex);
  const activeStep = resolvedSteps[activeIndex] ?? resolvedSteps[0];

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      width="100vw"
      height="100vh"
      bg="#000000"
      zIndex={999999}
      display="flex"
      alignItems="center"
      justifyContent="center"
      padding={4}
      css={{
        overflow: "hidden",
      }}
    >
      <Box
        ref={boxRef}
        bg="#000000"
        border="4px solid #ffffff"
        borderRadius={0}
        width="640px"
        maxWidth="92vw"
        p={6}
        position="relative"
        css={{
          borderTopColor: "#ffffff",
          borderLeftColor: "#ffffff",
          borderBottomColor: "#888888",
          borderRightColor: "#888888",
          boxShadow: "inset 2px 2px 0 #ffffff, inset -2px -2px 0 #333333, 0 0 20px rgba(255,255,255,0.15)",
        }}
      >
        {/* HD-2D風：洗練されたローディング */}
        <VStack align="center" gap={6}>
          {/* メインメッセージ - 1文字ずつ表示風 */}
          <Text
            fontSize="xl"
            color="#ffffff"
            fontFamily="monospace"
            textAlign="center"
            lineHeight={1.8}
            letterSpacing="0.12em"
            fontWeight="normal"
            css={{
              textShadow: "0 0 8px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.8)",
            }}
          >
            {customMessage || activeStep?.message || "よみこみ中です"}
          </Text>

          {/* HD-2D風プログレスバー */}
          <Box width="100%" position="relative">
            <Box
              width="100%"
              height="12px"
              border="2px solid #ffffff"
              bg="rgba(0,0,0,0.8)"
              position="relative"
              css={{
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6), 0 0 10px rgba(255,255,255,0.2)",
              }}
            >
              <Box
                ref={progressBarRef}
                position="absolute"
                left={0}
                top={0}
                height="100%"
                width="0%"
                bg="linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)"
                css={{
                  boxShadow: "0 0 12px rgba(255,255,255,0.6), inset 0 1px 0 rgba(255,255,255,0.4)",
                  filter: "brightness(1)",
                }}
              />
            </Box>
            {/* プログレス％表示 */}
            <Text
              fontSize="xs"
              color="rgba(255,255,255,0.7)"
              fontFamily="monospace"
              textAlign="center"
              mt={2}
              letterSpacing="0.1em"
            >
              {Math.round(progress)}%
            </Text>
          </Box>

          {/* オクトパス風装飾ドット */}
          <HStack gap={2} justify="center">
            <Box
              ref={dot1Ref}
              w="6px"
              h="6px"
              bg="#ffffff"
              css={{
                boxShadow: "0 0 8px rgba(255,255,255,0.8)",
                opacity: 0.3,
                transform: "scale(0.8)",
              }}
            />
            <Box
              ref={dot2Ref}
              w="6px"
              h="6px"
              bg="#ffffff"
              css={{
                boxShadow: "0 0 8px rgba(255,255,255,0.8)",
                opacity: 0.3,
                transform: "scale(0.8)",
              }}
            />
            <Box
              ref={dot3Ref}
              w="6px"
              h="6px"
              bg="#ffffff"
              css={{
                boxShadow: "0 0 8px rgba(255,255,255,0.8)",
                opacity: 0.3,
                transform: "scale(0.8)",
              }}
            />
          </HStack>
        </VStack>
      </Box>

    </Box>
  );
}

export default DragonQuestLoading;
