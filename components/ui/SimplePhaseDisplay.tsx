"use client";
import { Box, Text } from "@chakra-ui/react";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

// ドラクエ風フェーズアナウンス（シンプル版）
const getPhaseInfo = (status: string, canStartSorting: boolean = false) => {
  switch (status) {
    case "waiting":
      return { text: "ゲーム準備中", icon: "★" };
    case "clue":
      if (canStartSorting) {
        return {
          text: "みんなで相談してカードを並び替えよう！（ドラッグでできるよ）",
          icon: "◇",
        };
      }
      return { text: "連想ワードを考えよう", icon: "?" };
    case "playing":
      return { text: "順番に並べよう", icon: "▲" };
    case "reveal":
      return { text: "カードをめくっています", icon: "■" };
    case "finished":
      return { text: "結果発表！", icon: "◆" };
    default:
      return { text: "ゲーム進行中", icon: "▼" };
  }
};

interface SimplePhaseDisplayProps {
  roomStatus: string;
  canStartSorting?: boolean;
}

export function SimplePhaseDisplay({
  roomStatus,
  canStartSorting = false,
}: SimplePhaseDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const iconRef: any = useRef(null);
  const previousStatus = useRef<string>(roomStatus);
  const previousCanStart = useRef<boolean>(canStartSorting);

  const { text, icon } = getPhaseInfo(roomStatus, canStartSorting);

  const tlRef = useRef<any>(null);

  // フェーズ変更時のGSAPアニメーション
  useEffect(() => {
    if (!containerRef.current || !textRef.current || !iconRef.current) return;

    const container = containerRef.current;
    const textEl = textRef.current;
    const iconEl = iconRef.current;

    // reduced-motion の尊重
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 初回表示の場合 または 状態変更がない場合
    if (
      previousStatus.current === roomStatus &&
      previousCanStart.current === canStartSorting
    ) {
      if (prefersReduced) {
        gsap.set(container, { scale: 1, opacity: 1, y: 0 });
        gsap.set(iconEl, { rotation: 0 });
      } else {
        gsap.set(container, {
          scale: 0.8,
          opacity: 0,
          y: -20,
        });

        const tl = gsap.timeline();
        tlRef.current = tl;

        tl.to(container, {
          scale: 1,
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "back.out(1.7)",
          delay: 0.2,
        });

        tl.to(iconEl, {
          rotation: 360,
          duration: 0.8,
          ease: "elastic.out(1, 0.5)",
          delay: 0.4,
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
        duration: 0.2,
        ease: "power2.in",
      })
        .to(
          iconEl,
          {
            opacity: 0,
            rotation: "-=180",
            scale: 0.5,
            duration: 0.2,
            ease: "power2.in",
          },
          "-=0.2"
        )
        // ボックス全体を軽くパルス
        .to(container, {
          scale: 1.05,
          duration: 0.1,
          ease: "power2.out",
        })
        .to(container, {
          scale: 1,
          duration: 0.1,
          ease: "power2.out",
        })
        // 新しいコンテンツをフェードイン
        .to(textEl, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.3,
          ease: "back.out(1.5)",
        })
        .to(
          iconEl,
          {
            opacity: 1,
            rotation: "+=360",
            scale: 1,
            duration: 0.4,
            ease: "elastic.out(1, 0.6)",
          },
          "-=0.2"
        )
        // 完了時の軽やかなバウンス
        .to(container, {
          y: -3,
          duration: 0.15,
          ease: "power2.out",
        })
        .to(container, {
          y: 0,
          duration: 0.2,
          ease: "bounce.out",
        });
    }

    previousStatus.current = roomStatus;
    previousCanStart.current = canStartSorting;

    return () => {
      try {
        if (tlRef.current) {
          tlRef.current.kill();
          tlRef.current = null;
        }
        if (containerRef.current) {
          gsap.killTweensOf(containerRef.current);
          gsap.set(containerRef.current, {
            clearProps: "transform,opacity,x,y,rotation,scale",
          });
        }
        if (textRef.current) {
          gsap.killTweensOf(textRef.current);
          gsap.set(textRef.current, { clearProps: "opacity,y,scale" });
        }
        if (iconRef.current) {
          gsap.killTweensOf(iconRef.current);
          gsap.set(iconRef.current, { clearProps: "rotation,opacity,scale" });
        }
      } catch (e) {
        // ignore
      }
    };
  }, [roomStatus, canStartSorting, text, icon]);

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={{ base: "20px", md: "24px" }}
      left={{ base: "20px", md: "24px" }}
      zIndex={50}
      css={{
        pointerEvents: "none",
      }}
    >
      <Box
        display="inline-flex"
        alignItems="center"
        gap={2}
        px={4}
        py={2}
        bg="linear-gradient(135deg, rgba(0,48,112,0.95), rgba(0,32,80,0.98))" // ドラクエ風深い青グラデーション
        border="3px solid rgba(255,255,255,0.95)" // 太いドラクエ風ボーダー
        borderRadius={0}
        css={{
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px) saturate(1.2)",
        }}
      >
        <Text as="span" ref={iconRef} fontSize="lg" display="inline-block">
          {icon}
        </Text>

        <Text
          ref={textRef}
          fontSize={{ base: "xs", md: "sm" }}
          fontWeight={600}
          color="white"
          textShadow="1px 1px 0px #000"
          letterSpacing="0.5px"
          fontFamily="monospace"
          whiteSpace="nowrap"
        >
          ▼ {text} ▼
        </Text>
      </Box>
    </Box>
  );
}
