import { Box, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

const VICTORY_TITLE = "🏆 勝利！";
const FAILURE_TITLE = "💀 失敗…";
const VICTORY_SUBTEXT = "みんなの連携が実を結びました！";
const FAILURE_SUBTEXT = "もう一度チャレンジしてみましょう。";

interface GameResultOverlayProps {
  failed?: boolean;
  mode?: "overlay" | "inline"; // overlay: 中央に被せる, inline: 帯として表示
}

export function GameResultOverlay({
  failed,
  mode = "overlay",
}: GameResultOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const prefersReduced = useReducedMotionPreference();
  const playVictory = useSoundEffect("result_victory");
  const playFailure = useSoundEffect("result_failure");

  useEffect(() => {
    if (mode !== "overlay") return;
    if (failed) {
      playFailure();
    } else {
      playVictory();
    }
  }, [failed, mode, playFailure, playVictory]);

  useEffect(() => {
    if (mode !== "overlay") return;
    const overlay = overlayRef.current;
    const text = textRef.current;
    if (!overlay || !text) return;

    if (prefersReduced) {
      gsap.set(overlay, { opacity: 1, scale: 1, rotationX: 0, rotationY: 0 });
      gsap.set(text, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    const tl = gsap.timeline();
    tlRef.current = tl;

    if (failed) {
      // ドラクエ風劇的失敗演出！

      // Phase 1: 衝撃的登場
      tl.fromTo(
        overlay,
        {
          opacity: 0,
          scale: 1.8,
          rotationX: 30,
          rotationZ: -10,
          filter: "blur(8px) brightness(0.4) saturate(0.3)",
          transformOrigin: "50% 50%"
        },
        {
          opacity: 1,
          scale: 0.7,
          rotationX: 0,
          rotationZ: 0,
          filter: "blur(0px) brightness(0.8) saturate(0.7)",
          duration: 0.4,
          ease: "power4.out",
        }
      )

      // Phase 2: 重苦しい膨張
      .to(overlay, {
        scale: 1.15,
        duration: 0.35,
        ease: "power2.out",
        filter: "brightness(0.6) saturate(0.5)"
      })

      // Phase 3: テキスト重たい登場
      .fromTo(
        text,
        {
          opacity: 0,
          y: -30,
          scale: 1.4,
          rotationX: -20,
          filter: "blur(3px)"
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotationX: 0,
          filter: "blur(0px)",
          duration: 0.5,
          ease: "power3.out",
        },
        "-=0.2"
      )

      // Phase 4: 激しい振動（地震のような）
      .to(overlay, {
        x: () => gsap.utils.random(-15, 15),
        y: () => gsap.utils.random(-8, 8),
        rotation: () => gsap.utils.random(-2, 2),
        duration: 0.06,
        repeat: 20,
        yoyo: true,
        ease: "power2.inOut",
      })

      // Phase 5: 暗転効果
      .to(overlay, {
        filter: "brightness(0.4) saturate(0.3) contrast(1.3)",
        boxShadow: "0 0 20px rgba(139,0,0,0.6), inset 0 0 15px rgba(0,0,0,0.8)",
        duration: 0.3,
        ease: "power2.out"
      }, "-=0.5")

      // Phase 6: 重力落下演出
      .to(overlay, {
        y: 15,
        scale: 1.05,
        duration: 0.6,
        ease: "bounce.out"
      })
      .to(text, {
        y: 5,
        duration: 0.6,
        ease: "bounce.out"
      }, "-=0.6")

      // Phase 7: 最終位置へ重たく安定
      .to(overlay, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        filter: "brightness(0.7) saturate(0.6)",
        boxShadow: "0 0 12px rgba(139,0,0,0.4), inset 0 0 8px rgba(0,0,0,0.6)",
        duration: 0.4,
        ease: "power3.out"
      })
      .to(text, {
        y: 0,
        duration: 0.4,
        ease: "power3.out"
      }, "-=0.4")

      // Phase 8: 時々の苦しみ + 永続浮遊
      .to(
        overlay,
        {
          y: 3,
          rotation: -0.3,
          duration: 3.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=0.1"
      )
      .to(
        text,
        {
          y: 1,
          duration: 3.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=3.5"
      )

      // Phase 9: 時々の痙攣的な動き（失敗の余韻）
      .to(
        overlay,
        {
          x: () => gsap.utils.random(-3, 3),
          scale: () => gsap.utils.random(0.98, 1.02),
          duration: 0.15,
          ease: "power2.out",
          repeat: 2,
          yoyo: true,
          repeatDelay: 4.5, // 4.5秒ごとに痙攣
        },
        3 // 3秒後から開始
      )
      .to(
        text,
        {
          x: () => gsap.utils.random(-1, 1),
          duration: 0.15,
          ease: "power2.out",
          repeat: 2,
          yoyo: true,
          repeatDelay: 4.5,
        },
        3
      )

      // Phase 10: ランダムな暗転フラッシュ（絶望感の演出）
      .to(
        overlay,
        {
          filter: "brightness(0.3) saturate(0.2)",
          duration: 0.08,
          ease: "power2.inOut",
          yoyo: true,
          repeat: 1,
          repeatDelay: 7.2, // 7.2秒ごとに暗転
        },
        5 // 5秒後から開始
      );
    } else {
      // ドラクエ風爆発演出！

      // Phase 1: ドラマチック登場
      tl.fromTo(
        overlay,
        {
          opacity: 0,
          scale: 0.3,
          rotationX: -45,
          rotationY: 25,
          rotationZ: -15,
          filter: "blur(12px) brightness(0.3)",
          transformOrigin: "50% 50%"
        },
        {
          opacity: 1,
          scale: 1.25,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          filter: "blur(0px) brightness(1.3)",
          duration: 0.6,
          ease: "back.out(2.5)",
        }
      )

      // Phase 2: 強烈なバウンス（ドラクエのレベルアップ感）
      .to(overlay, {
        scale: 0.8,
        duration: 0.12,
        ease: "power4.in"
      })
      .to(overlay, {
        scale: 1.4,
        rotation: 3,
        duration: 0.25,
        ease: "elastic.out(1.8, 0.3)"
      })
      .to(overlay, {
        scale: 0.95,
        rotation: -2,
        duration: 0.15,
        ease: "power3.in"
      })
      .to(overlay, {
        scale: 1.15,
        rotation: 1,
        duration: 0.2,
        ease: "back.out(2)",
        filter: "brightness(1.5) saturate(1.3)"
      })

      // Phase 3: テキスト躍動
      .fromTo(
        text,
        {
          opacity: 0,
          y: 50,
          scale: 0.6,
          rotationX: 45,
          filter: "blur(4px)"
        },
        {
          opacity: 1,
          y: 0,
          scale: 1.1,
          rotationX: 0,
          filter: "blur(0px)",
          duration: 0.45,
          ease: "back.out(2.2)",
        },
        "-=0.4"
      )

      // Phase 4: 派手な跳ね演出
      .to(text, {
        y: -12,
        scale: 1.25,
        rotation: -1,
        duration: 0.3,
        ease: "power2.out"
      })
      .to(text, {
        y: 8,
        scale: 0.9,
        rotation: 1,
        duration: 0.2,
        ease: "power2.in"
      })
      .to(text, {
        y: -5,
        scale: 1.05,
        rotation: 0,
        duration: 0.35,
        ease: "elastic.out(1.5, 0.4)"
      })

      // Phase 5: 光る演出
      .to(overlay, {
        boxShadow: "0 0 25px rgba(255,215,0,0.8), 0 0 50px rgba(255,215,0,0.4), inset 0 0 15px rgba(255,255,255,0.3)",
        duration: 0.3,
        ease: "power2.out"
      }, "-=0.2")

      // Phase 6: 最終安定 + 永続浮遊
      .to(overlay, {
        scale: 1.08,
        rotation: 0,
        filter: "brightness(1.2)",
        boxShadow: "0 0 15px rgba(255,215,0,0.6), inset 0 0 8px rgba(255,255,255,0.2)",
        duration: 0.4,
        ease: "power3.out"
      })
      .to(text, {
        y: 0,
        scale: 1,
        duration: 0.3,
        ease: "elastic.out(1.3, 0.5)"
      }, "-=0.2")

      // Phase 7: ドラクエらしい永続浮遊
      .to(
        overlay,
        {
          y: -8,
          rotationZ: 1,
          scale: 1.05,
          duration: 2.2,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=0.1"
      )
      .to(
        text,
        {
          y: -3,
          rotationZ: -0.5,
          duration: 2.2,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=2.2"
      )

      // パーティクル風演出（キラキラ）
      .set({}, {}, 0) // パーティクル用のプレースホルダー
      ;
    }

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
      // より確実なクリーンアップ
      gsap.set(overlay, {
        clearProps: "all"
      });
      gsap.set(text, {
        clearProps: "all"
      });
    };
  }, [failed, mode, prefersReduced]);

  const title = failed ? FAILURE_TITLE : VICTORY_TITLE;
  const subtext = failed ? FAILURE_SUBTEXT : VICTORY_SUBTEXT;

  if (mode === "inline") {
    return (
      <Box
        color="white"
        letterSpacing={0.5}
        whiteSpace="nowrap"
        fontFamily="monospace"
        textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        bg={UI_TOKENS.COLORS.panelBg80}
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        px={4}
        py={2}
        fontWeight={700}
      >
        {title}
      </Box>
    );
  }

  return (
    <Box
      position="absolute"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      zIndex={10}
    >
      <Box
        ref={overlayRef}
        px={{ base: 6, md: 8 }}
        py={{ base: 4, md: 5 }}
        borderRadius={0}
        fontWeight={800}
        fontSize={{ base: "22px", md: "28px" }}
        color="white"
        letterSpacing={1}
        border="3px solid"
        borderColor={UI_TOKENS.COLORS.whiteAlpha90}
        css={{
          background: UI_TOKENS.COLORS.panelBg,
          boxShadow:
            "3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.6), inset 1px 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        <Box ref={textRef} textAlign="center">
          {title}
          <Text
            fontSize={{ base: "15px", md: "17px" }}
            mt={2}
            opacity={0.9}
            fontFamily="monospace"
            fontWeight={500}
            letterSpacing="0.5px"
            textShadow="1px 1px 0px #000"
          >
            {subtext}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
