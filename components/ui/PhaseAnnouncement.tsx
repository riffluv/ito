"use client";
import { Box, Text, chakra } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

// ドラクエ風フェーズアナウンス
const getPhaseAnnouncement = (status: string) => {
  switch (status) {
    case "waiting":
      return { text: "▼ ゲーム準備中 ▼", icon: "⏳" };
    case "clue":
      return { text: "▼ 連想ワードを考えよう ▼", icon: "💭" };
    case "playing":
      return { text: "▼ 順番に並べよう ▼", icon: "🎯" };
    case "reveal":
      return { text: "▼ カードをめくっています ▼", icon: "👀" };
    case "finished":
      return { text: "▼ 結果発表！ ▼", icon: "🎉" };
    default:
      return { text: "▼ ゲーム進行中 ▼", icon: "⚡" };
  }
};

interface PhaseAnnouncementProps {
  roomStatus: string;
}

export function PhaseAnnouncement({ roomStatus }: PhaseAnnouncementProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const previousStatus = useRef<string>(roomStatus);

  const { text, icon } = getPhaseAnnouncement(roomStatus);

  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const prefersReduced = useReducedMotionPreference();

  // フェーズ変更時の豪華なGSAPアニメーション
  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    const iconEl = iconRef.current;

    const cleanup = () => {
      try {
        if (tlRef.current) {
          tlRef.current.kill();
          tlRef.current = null;
        }
        if (container) {
          gsap.killTweensOf(container);
          gsap.set(container, {
            clearProps: "transform,opacity,x,y,rotation,scale",
          });
        }
        if (textEl) {
          gsap.killTweensOf(textEl);
          gsap.set(textEl, { clearProps: "opacity,y,scale" });
        }
        if (iconEl) {
          gsap.killTweensOf(iconEl);
          gsap.set(iconEl, { clearProps: "rotation,opacity,scale" });
        }
      } catch {
        // ignore
      }
    };

    if (!container || !textEl || !iconEl) {
      return cleanup;
    }

    // 初回表示時のアニメーション
    if (previousStatus.current === roomStatus) {
      if (prefersReduced) {
        gsap.set(container, { scale: 1, opacity: 1, y: 0, rotationX: 0 });
        gsap.set(iconEl, { rotation: 0 });
      } else {
        gsap.set(container, {
          scale: 0.8,
          opacity: 0,
          y: -20,
          rotationX: -90,
        });

        const tl = gsap.timeline();
        tlRef.current = tl;

        tl.to(container, {
          scale: 1,
          opacity: 1,
          y: 0,
          rotationX: 0,
          duration: 0.6,
          ease: "back.out(1.7)",
          delay: 0.2,
        });

        tl.to(iconEl, {
          rotation: 354, // AI感除去: 360° → 354°
          duration: 0.83, // AI感除去: 0.8 → 0.83
          ease: "elastic.out(1, 0.5)",
          delay: 0.42, // AI感除去: 0.4 → 0.42
        });
      }
    } else {
      // フェーズ変更時の美しいトランジション
      const tl = gsap.timeline();
      tlRef.current = tl;

      // 現在のコンテンツをフェードアウト
      tl.to(textEl, {
        opacity: 0,
        y: -10,
        scale: 0.9,
        duration: 0.19, // AI感除去: 0.2 → 0.19
        ease: "power2.in",
      })
        .to(
          iconEl,
          {
            opacity: 0,
            rotation: "-=173", // AI感除去: 180° → 173°
            scale: 0.5,
            duration: 0.21, // AI感除去: 0.2 → 0.21
            ease: "power2.in",
          },
          "-=0.2"
        )
        // ボックス全体を軽くパルス
        .to(container, {
          scale: 1.05,
          duration: 0.11, // AI感除去: 0.1 → 0.11
          ease: "power2.out",
        })
        .to(container, {
          scale: 1,
          duration: 0.13, // AI感除去: 0.1 → 0.13
          ease: "power2.out",
        })
        // 新しいコンテンツをフェードイン
        .to(textEl, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.28, // AI感除去: 0.3 → 0.28
          ease: "back.out(1.5)",
        })
        .to(
          iconEl,
          {
            opacity: 1,
            rotation: "+=357", // AI感除去: 360° → 357°
            scale: 1,
            duration: 0.43, // AI感除去: 0.4 → 0.43
            ease: "elastic.out(1, 0.6)",
          },
          "-=0.2"
        )
        // 完了時の軽やかなバウンス
        .to(container, {
          y: -3,
          duration: 0.17, // AI感除去: 0.15 → 0.17
          ease: "power2.out",
        })
        .to(container, {
          y: 0,
          duration: 0.23, // AI感除去: 0.2 → 0.23
          ease: "bounce.out",
        });
    }

    previousStatus.current = roomStatus;

    return cleanup;
  }, [roomStatus, text, icon, prefersReduced]);

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={{ base: "20px", md: "24px" }}
      right={{ base: "20px", md: "24px" }}
      zIndex={50}
      css={{
        pointerEvents: "none", // 操作の邪魔にならない
      }}
    >
      <Box
        display="inline-flex"
        alignItems="center"
        gap={2}
        px={4}
        py={2}
        bg={UI_TOKENS.COLORS.panelBg}
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0} // 角ばったドラクエ風
        css={{
          boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
          backdropFilter: "blur(8px) saturate(1.2)",
        }}
      >
        <chakra.span
          ref={iconRef}
          fontSize="lg"
          display="inline-block"
        >
          {icon}
        </chakra.span>

        <chakra.p
          ref={textRef}
          fontSize={{ base: "xs", md: "sm" }}
          fontWeight={600}
          color="white"
          textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
          letterSpacing="0.5px"
          fontFamily="monospace"
          whiteSpace="nowrap"
        >
          {text}
        </chakra.p>
      </Box>
    </Box>
  );
}
