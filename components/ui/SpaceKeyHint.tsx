"use client";
import React from "react";
import { Box, Text } from "@chakra-ui/react";
import { gsap } from "gsap";
import { FaArrowDown } from "react-icons/fa";

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
      }, 300);

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
        setTimeout(() => setIsVisible(false), 100);
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
      duration: 0.6,
      ease: "back.out(1.3)",
    });

    // 2. 矢印バウンス登場
    tl.to(
      arrow,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.7)",
      },
      "-=0.3"
    );

    // 3. 矢印が上下にバウンス（2回）
    tl.to(arrow, {
      y: "+=8",
      duration: 0.4,
      repeat: 3,
      yoyo: true,
      ease: "sine.inOut",
    });

    // 4. パーティクル拡散（8方向）
    tl.to(
      particles,
      {
        scale: 1.2,
        x: (i) => Math.cos((i * Math.PI) / 4) * 40,
        y: (i) => Math.sin((i * Math.PI) / 4) * 40,
        opacity: 0,
        duration: 1.0,
        ease: "power2.out",
        stagger: 0.05,
      },
      "-=1.2"
    );

    // 5. 2秒間表示してからフェードアウト
    tl.to(
      container,
      {
        opacity: 0,
        duration: 0.5,
        ease: "power2.inOut",
      },
      "+=1.5"
    );
  };

  if (!isVisible) return null;

  return (
    <Box
      ref={containerRef}
      position="fixed"
      bottom={{ base: "calc(20px + 60px + 10px)", md: "calc(24px + 62px + 15px)" }}
      left={{ base: "50%", md: "calc(50% - 80px)" }}
      transform="translateX(-50%)"
      zIndex={45}
      pointerEvents="none"
      opacity={0}
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
        {Array.from({ length: 8 }).map((_, i) => (
          <Box
            key={i}
            ref={(el: HTMLDivElement | null) => {
              if (el) particlesRef.current[i] = el;
            }}
            position="absolute"
            w="6px"
            h="6px"
            bg="rgba(255,220,120,0.95)"
            borderRadius="50%"
            boxShadow="0 0 8px rgba(255,200,100,0.7)"
          />
        ))}
      </Box>

      {/* メインコンテンツ */}
      <Box textAlign="center">
        {/* 説明テキスト */}
        <Box
          ref={textRef}
          bg="rgba(28,32,42,0.98)"
          color="rgba(255,255,255,0.98)"
          px="18px"
          py="10px"
          borderRadius={0}
          border="2px solid rgba(255,255,255,0.9)"
          boxShadow="3px 3px 0 rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.15)"
          fontFamily="'Courier New', monospace"
          fontSize={{ base: "13px", md: "15px" }}
          fontWeight="700"
          textShadow="1px 1px 0 rgba(0,0,0,0.9)"
          whiteSpace="nowrap"
          mb="8px"
        >
          <Text as="span" color="rgba(255,220,120,0.98)" fontWeight="800">
            SPACE
          </Text>
          <Text as="span" mx="6px">
            キーで素早く入力！
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
          color="rgba(255,220,120,0.98)"
          fontSize="28px"
          filter="drop-shadow(0 0 8px rgba(255,200,100,0.6)) drop-shadow(1px 1px 2px rgba(0,0,0,0.8))"
        >
          <FaArrowDown />
        </Box>
      </Box>
    </Box>
  );
}
