import { Box, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

const VICTORY_TITLE = "✨ 勝利！";
const FAILURE_TITLE = "⚠ 失敗…";
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
      tl.fromTo(
        overlay,
        { opacity: 0, scale: 0.65, rotationX: -25, filter: "blur(6px)" },
        {
          opacity: 1,
          scale: 1.05,
          rotationX: 0,
          filter: "blur(0px)",
          duration: 0.5,
          ease: "back.out(1.7)",
        }
      )
        .fromTo(
          text,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
          "-=0.2"
        )
        .to(overlay, {
          x: () => gsap.utils.random(-12, 12),
          y: () => gsap.utils.random(-6, 6),
          duration: 0.12,
          repeat: 12,
          yoyo: true,
          ease: "sine.inOut",
        })
        .to(overlay, { x: 0, y: 0, duration: 0.25, ease: "power3.out" });
    } else {
      tl.fromTo(
        overlay,
        { opacity: 0, scale: 0.7, rotationX: 20, rotationY: -10, filter: "blur(6px)" },
        {
          opacity: 1,
          scale: 1.05,
          rotationX: 0,
          rotationY: 0,
          filter: "blur(0px)",
          duration: 0.4,
          ease: "back.out(1.8)",
        }
      )
        .fromTo(
          text,
          { opacity: 0, y: 26, scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.36,
            ease: "elastic.out(1.2, 0.4)",
          },
          "-=0.18"
        )
        .to(overlay, {
          scale: 0.96,
          duration: 0.16,
          ease: "power2.inOut",
        })
        .to(
          overlay,
          {
            scale: 1.04,
            duration: 0.28,
            ease: "elastic.out(1.4, 0.35)",
          },
          "-=0.05"
        )
        .to(
          text,
          {
            scale: 1.08,
            duration: 0.22,
            ease: "power2.out",
          },
          "-=0.2"
        )
        .to(
          text,
          {
            scale: 1,
            duration: 0.24,
            ease: "elastic.out(1.4, 0.4)",
          },
          "-=0.1"
        )
        .to(
          overlay,
          {
            y: -5,
            rotationZ: 0.8,
            duration: 1.6,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          },
          "-=0.2"
        )
        .to(
          text,
          {
            y: -2,
            duration: 1.6,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          },
          "-=1.6"
        );
    }

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
      gsap.set(overlay, {
        clearProps: "transform,opacity,filter,x,y,rotation,scale",
      });
      gsap.set(text, {
        clearProps: "transform,opacity,filter,x,y,rotation,scale",
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
