"use client";
import { Text } from "@chakra-ui/react";
import React, { memo, useEffect, useRef } from "react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";

interface DiamondNumberCardProps {
  number: number | null;
  isAnimating?: boolean;
}

// ⚡ PERFORMANCE: 数字が変わった時のみ再レンダリング
export const DiamondNumberCard = memo(function DiamondNumberCard({ number, isAnimating = false }: DiamondNumberCardProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const previousNumber = useRef<number | null>(null);

  useEffect(() => {
    if (!textRef.current) return;

    // 数字が変わった瞬間を検出
    const isNewNumber = previousNumber.current === null && typeof number === "number";
    const isNumberChanged =
      previousNumber.current !== null &&
      typeof number === "number" &&
      previousNumber.current !== number;

    if (isNewNumber || isNumberChanged) {
      // 派手な登場・変更演出（軽量化：1つのtimelineに統合）
      const tl = gsap.timeline({ defaults: { ease: "back.out(1.85)" } });

      tl.fromTo(
        textRef.current,
        {
          scale: 0,
          rotation: -173,
          opacity: 0,
        },
        {
          scale: 1.28,
          rotation: 0,
          opacity: 1,
          duration: 0.43,
        }
      )
      .to(textRef.current, {
        scale: 1,
        duration: 0.17,
        ease: "power2.out",
      }, "-=0.08")
      // 光のフラッシュ演出（同一timeline内で実行）
      .to(textRef.current, {
        textShadow: "0 0 19px rgba(255,255,255,0.9), 0 0 37px rgba(58,176,255,0.8), 0 3px 7px rgba(0,0,0,0.6)",
        duration: 0.12,
        ease: "power2.out",
      }, "-=0.17")
      .to(textRef.current, {
        textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6)",
        duration: 0.34,
        ease: "power2.in",
      });

      previousNumber.current = number;
    } else if (isAnimating && previousNumber.current !== null) {
      // 通常のポップアニメーション
      gsap.to(textRef.current, {
        scale: 1.14,
        duration: 0.13,
        ease: "back.out(1.4)",
        yoyo: true,
        repeat: 1,
      });
    } else {
      // 初回レンダリングやリセット時
      previousNumber.current = number;
    }
  }, [number, isAnimating]);

  return (
    <Text
      ref={textRef}
      fontSize="40px"
      fontWeight="700"
      color="rgba(255,255,255,0.95)"
      fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif"
      textShadow="0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6)"
      flexShrink={0}
      lineHeight="1"
      display="flex"
      alignItems="center"
      justifyContent="center"
      w="64px"
      h="44px"
      letterSpacing="-0.02em"
    >
      {typeof number === "number" ? number : "?"}
    </Text>
  );
}, (prev, next) => {
  // 数字とアニメーション状態が同じなら再レンダリングしない
  return prev.number === next.number && prev.isAnimating === next.isAnimating;
});