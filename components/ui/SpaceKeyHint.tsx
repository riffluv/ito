"use client";
import React from "react";
import { Box, Text } from "@chakra-ui/react";
import { gsap } from "gsap";
import { FaArrowDown } from "react-icons/fa";
import {
  HINT_POSITIONS,
  HINT_COMMON_STYLES,
  PARTICLE_CONFIG,
  HINT_ANIMATION_CONFIG,
} from "./hints/constants";

interface SpaceKeyHintProps {
  /** 表示トリガー（clueEditable状態など） */
  shouldShow: boolean;
}

/**
 * 🎮 Spaceキーヒントコンポーネント（毎回表示版）
 *
 * ゲーム開始直後に、可愛い矢印アニメーションで
 * 「Spaceキーで素早く入力！」を告知する。
 *
 * 演出内容:
 * 1. テキストが上からフェードイン
 * 2. 矢印がバウンスしながら下を指す
 * 3. パーティクルが8方向に拡散
 * 4. 2.5秒後に全体フェードアウト
 */
export default function SpaceKeyHint({ shouldShow }: SpaceKeyHintProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const arrowRef = React.useRef<HTMLDivElement>(null);
  const particlesRef = React.useRef<HTMLDivElement[]>([]);
  const hasAnimatedRef = React.useRef(false); // 実行済みフラグ

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    if (shouldShow && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true; // 実行済みマーク
      setIsVisible(true);

      // 少し遅延してアニメーション開始（DOMマウント待ち）
      const timer = setTimeout(() => {
        runAnimation();
      }, HINT_ANIMATION_CONFIG.startDelay);

      return () => clearTimeout(timer);
    }

    // shouldShowがfalseになったらリセット
    if (!shouldShow) {
      hasAnimatedRef.current = false;
      setIsVisible(false);
    }
  }, [shouldShow]);

  const runAnimation = () => {
    const container = containerRef.current;
    const text = textRef.current;
    const arrow = arrowRef.current;
    const particles = particlesRef.current;

    if (!container || !text || !arrow) return;

    // タイムライン作成
    const tl = gsap.timeline({
      onComplete: () => {
        // アニメーション終了後に非表示
        setTimeout(() => setIsVisible(false), HINT_ANIMATION_CONFIG.endDelay);
      },
    });

    // 初期状態リセット
    gsap.set(text, { opacity: 0, y: -20, scale: 0.9 });
    gsap.set(arrow, { opacity: 0, y: -10, scale: 0.8 });
    gsap.set(particles, { scale: 0, opacity: 1 });
    gsap.set(container, { opacity: 1 });

    // 1. テキストフェードイン
    tl.to(text, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.55,
      ease: "cubic-bezier(.2,1,.3,1.05)",
    });

    // 2. 矢印バウンス登場
    tl.to(
      arrow,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.48,
        ease: "cubic-bezier(.18,.95,.28,1.08)",
      },
      "-=0.3"
    );

    // 3. 矢印が上下にバウンス（2回）
    tl.to(arrow, {
      y: "+=8",
      duration: 0.42,
      repeat: 3,
      yoyo: true,
      ease: "cubic-bezier(.4,.1,.6,.9)",
    });

    // 4. パーティクル拡散（4方向）
    tl.to(
      particles,
      {
        scale: 1.2,
        x: (i) => [18, -18, 22, -22][i] || 0,
        y: (i) => [22, 22, -18, -18][i] || 0,
        opacity: 0,
        duration: 0.95,
        ease: "cubic-bezier(.3,.9,.5,1)",
        stagger: 0.06,
      },
      "-=1.2"
    );

    // 5. 2秒間表示してからフェードアウト
    tl.to(
      container,
      {
        opacity: 0,
        duration: 0.52,
        ease: "cubic-bezier(.4,.2,.6,1)",
      },
      "+=1.5"
    );
  };

  if (!isVisible) return null;

  return (
    <Box
      ref={containerRef}
      position="fixed"
      bottom={HINT_POSITIONS.SPACE.bottom}
      left={HINT_POSITIONS.SPACE.left}
      transform={HINT_POSITIONS.SPACE.transform}
      zIndex={HINT_COMMON_STYLES.zIndex}
      pointerEvents={HINT_COMMON_STYLES.pointerEvents}
      opacity={HINT_COMMON_STYLES.initialOpacity}
    >
      {/* パーティクルコンテナ */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w="0"
        h="0"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Box
            key={i}
            ref={(el: HTMLDivElement | null) => {
              if (el) particlesRef.current[i] = el;
            }}
            position="absolute"
            w="3px"
            h="3px"
            bg="rgba(252,218,108,0.88)"
            borderRadius="50%"
            boxShadow="0 0 6px rgba(252,218,108,0.5)"
          />
        ))}
      </Box>

      {/* メインコンテンツ */}
      <Box textAlign="center">
        {/* 説明テキスト */}
        <Box
          ref={textRef}
          bg="rgba(28,32,42,0.98)"
          color="rgba(255,255,255,0.96)"
          px="17px"
          py="11px"
          borderRadius="2px"
          border="3px solid rgba(255,255,255,0.88)"
          boxShadow="2px 3px 0 rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.12), inset -1px -1px 0 rgba(0,0,0,0.3)"
          fontFamily="'Courier New', monospace"
          fontSize={{ base: "13px", md: "15px" }}
          fontWeight="700"
          textShadow="1px 1px 0 rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.6)"
          whiteSpace="nowrap"
          mb="8px"
        >
          <Text as="span" color="rgba(252,218,108,0.94)" fontWeight="800">
            ▶ SPACE
          </Text>
          <Text as="span" mx="7px" letterSpacing="0.02em">
            で入力
          </Text>
        </Box>

        {/* 可愛い矢印 */}
        <Box
          ref={arrowRef}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          w="36px"
          h="36px"
          color="rgba(252,218,108,0.94)"
          fontSize="28px"
          filter="drop-shadow(0 0 6px rgba(252,218,108,0.4)) drop-shadow(1px 2px 1px rgba(0,0,0,0.85))"
        >
          <FaArrowDown />
        </Box>
      </Box>
    </Box>
  );
}
