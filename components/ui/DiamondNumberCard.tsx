"use client";
import { Text } from "@chakra-ui/react";
import React, { useEffect, useRef } from "react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";

interface DiamondNumberCardProps {
  number: number | null;
  isAnimating?: boolean;
}

export function DiamondNumberCard({ number, isAnimating = false }: DiamondNumberCardProps) {
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
      // 派手な登場・変更演出
      const tl = gsap.timeline({ defaults: { ease: "back.out(2)" } });

      tl.fromTo(
        textRef.current,
        {
          scale: 0,
          rotation: -180,
          opacity: 0,
        },
        {
          scale: 1.3,
          rotation: 0,
          opacity: 1,
          duration: 0.5,
        }
      ).to(textRef.current, {
        scale: 1,
        duration: 0.2,
        ease: "power2.out",
      });

      // 光のフラッシュ演出
      gsap
        .timeline()
        .to(textRef.current, {
          textShadow: "0 0 20px rgba(255,255,255,0.9), 0 0 40px rgba(58,176,255,0.8), 0 4px 8px rgba(0,0,0,0.6)",
          duration: 0.15,
          ease: "power2.out",
        })
        .to(textRef.current, {
          textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6)",
          duration: 0.4,
          ease: "power2.in",
        });

      previousNumber.current = number;
    } else if (isAnimating && previousNumber.current !== null) {
      // 通常のポップアニメーション
      gsap.to(textRef.current, {
        scale: 1.15,
        duration: 0.15,
        ease: "back.out(1.5)",
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
      minW="44px"
      h="44px"
      letterSpacing="-0.02em"
    >
      {typeof number === "number" ? number : "?"}
    </Text>
  );
}