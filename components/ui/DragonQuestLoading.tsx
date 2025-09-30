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
          boxShadow: "inset 2px 2px 0 #ffffff, inset -2px -2px 0 #333333",
        }}
      >
        {/* シンプルなドラクエ風：黒と白だけで勝負 */}
        <VStack align="center" gap={8}>
          {/* メインメッセージ */}
          <Text
            fontSize="xl"
            color="#ffffff"
            fontFamily="monospace"
            textAlign="center"
            lineHeight={1.8}
            letterSpacing="0.1em"
            fontWeight="normal"
          >
            {customMessage || activeStep?.message || "よみこみ中です..."}
          </Text>

          {/* シンプルなドット */}
          <Text
            fontSize="xl"
            color="#ffffff"
            fontFamily="monospace"
            css={{ animation: "dqSimpleDots 1.2s ease-in-out infinite" }}
            textAlign="center"
          >
            ・・・
          </Text>
        </VStack>
      </Box>

      <style jsx>{`
        @keyframes dqSimpleDots {
          0% {
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.3;
          }
        }
      `}</style>
    </Box>
  );
}

export default DragonQuestLoading;
