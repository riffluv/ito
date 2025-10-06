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
    const element = textRef.current;
    if (!element) return;

    const hasNumber = typeof number === "number";
    const previous = previousNumber.current;
    const numberChanged = hasNumber && previous !== number;

    gsap.killTweensOf(element);

    if (numberChanged) {
      previousNumber.current = number;
      gsap.set(element, { willChange: "transform" });

      gsap.timeline({
        defaults: { ease: "power2.out" },
        onComplete: () => {
          gsap.set(element, { willChange: 'auto', scale: 1, y: 0, opacity: 1 });
        },
      })
        .fromTo(
          element,
          { scale: 0.7, y: 12, opacity: 0.82 },
          { scale: 1.08, y: 0, opacity: 1, duration: 0.24 }
        )
        .to(
          element,
          { scale: 1, duration: 0.18, ease: "back.out(1.4)" },
          "-=0.08"
        );
    } else if (isAnimating && hasNumber) {
      gsap.to(element, {
        scale: 1.05,
        duration: 0.18,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      });
    } else if (hasNumber) {
      previousNumber.current = number;
      gsap.set(element, { scale: 1, y: 0, opacity: 1 });
    } else {
      previousNumber.current = null;
    }

    return () => {
      gsap.killTweensOf(element);
      gsap.set(element, { willChange: 'auto' });
    };
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
