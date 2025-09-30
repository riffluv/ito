"use client";
import { Box, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import Tooltip from "@/components/ui/Tooltip";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

// ドラクエ風フェーズアナウンス（シンプル版）
const getPhaseInfo = (status: string, canStartSorting: boolean = false) => {
  switch (status) {
    case "waiting":
      return { text: "ゲーム準備中", icon: "★" };
    case "clue":
      if (canStartSorting) {
        return {
          text: "みんなで相談してカードを並び替えよう！（ドラッグ可）",
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
  topicText?: string | null;
}

export function SimplePhaseDisplay({
  roomStatus,
  canStartSorting = false,
  topicText = null,
}: SimplePhaseDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const iconRef: any = useRef(null);
  const topicRef = useRef<HTMLDivElement>(null);
  const previousStatus = useRef<string>(roomStatus);
  const previousCanStart = useRef<boolean>(canStartSorting);
  const previousTopicText = useRef<string | null>(topicText);

  const { text, icon } = getPhaseInfo(roomStatus, canStartSorting);

  const tlRef = useRef<any>(null);
  const prefersReduced = useReducedMotionPreference();

  // フェーズ変更時のGSAPアニメーション
  useEffect(() => {
    if (!containerRef.current || !textRef.current || !iconRef.current) return;

    const container = containerRef.current;
    const textEl = textRef.current;
    const iconEl = iconRef.current;

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
        if (topicRef.current) {
          gsap.killTweensOf(topicRef.current);
          gsap.set(topicRef.current, { clearProps: "scale,y" });
        }
      } catch (e) {
        // ignore
      }
    };
  }, [roomStatus, canStartSorting, text, icon, prefersReduced]);

  // お題テキスト変更時のぴょーん！アニメーション
  useEffect(() => {
    if (!topicRef.current || !topicText) return;

    // お題テキストが変更された場合のみアニメーション
    if (previousTopicText.current !== null && previousTopicText.current !== topicText) {
      const topicEl = topicRef.current;

      if (!prefersReduced) {
        // ぴょーん！バウンスアニメーション
        const tl = gsap.timeline();

        tl.to(topicEl, {
          scale: 0.85,
          y: 2,
          duration: 0.1,
          ease: "power2.in",
        })
        .to(topicEl, {
          scale: 1.15,
          y: -6,
          duration: 0.3,
          ease: "back.out(1.8)",
        })
        .to(topicEl, {
          scale: 1,
          y: 0,
          duration: 0.4,
          ease: "elastic.out(1, 0.5)",
        });
      }
    }

    previousTopicText.current = topicText;
  }, [topicText, prefersReduced]);

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={{ base: "8px", md: "12px" }}
      left={{ base: "16px", md: "20px" }}
      zIndex={70}
      display="flex"
      flexDirection="column"
      gap={{ base: 1.5, md: 2 }}
      maxWidth="min(92vw, 520px)"
      css={{
        pointerEvents: "none",
      }}
    >
      {/* フェーズアナウンス（シームレス・大きく・真っ白） */}
      <Box display="flex" alignItems="center" gap={{ base: 2, md: 2.5 }}>
        <Text as="span" ref={iconRef} fontSize={{ base: "lg", md: "xl" }} display="inline-block" flexShrink={0}
          css={{
            filter: "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.9)) drop-shadow(0 6px 12px rgba(0, 0, 0, 0.7))",
          }}
        >
          {icon}
        </Text>
        <Text
          ref={textRef}
          fontSize={{ base: "sm", md: "md" }}
          fontWeight={700}
          color="rgb(255, 255, 255)"
          letterSpacing="0.4px"
          fontFamily="monospace"
          css={{
            textShadow: `
              0 3px 10px rgba(0, 0, 0, 0.95),
              0 6px 20px rgba(0, 0, 0, 0.8),
              1px 1px 0 rgba(0, 0, 0, 0.9),
              2px 2px 0 rgba(0, 0, 0, 0.7)
            `,
            filter: "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.8))",
          }}
        >
          {text}
        </Text>
      </Box>

      {/* お題バッジ（シームレス・大きく・ゴールドグロー強化） */}
      {topicText ? (
        <Tooltip content={topicText} openDelay={200} showArrow>
          <Box
            ref={topicRef}
            display="inline-flex"
            alignItems="center"
            gap={{ base: 2, md: 2.5 }}
            px={{ base: 2.5, md: 3 }}
            py={{ base: 1.5, md: 2 }}
            position="relative"
            css={{
              background: "linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 165, 0, 0.25) 100%)",
              backdropFilter: "blur(12px) saturate(1.3)",
              borderRadius: "4px",
              border: "1px solid rgba(255, 215, 0, 0.4)",
              boxShadow: `
                0 4px 20px rgba(0, 0, 0, 0.8),
                0 8px 40px rgba(0, 0, 0, 0.6),
                inset 0 1px 0 rgba(255, 215, 0, 0.35),
                inset 0 -1px 0 rgba(0, 0, 0, 0.6),
                0 0 30px rgba(255, 215, 0, 0.45),
                0 0 60px rgba(255, 215, 0, 0.25)
              `,
            }}
          >
            <Text
              as="span"
              fontSize={{ base: "sm", md: "md" }}
              fontWeight={900}
              color="rgb(255, 255, 255)"
              letterSpacing="1px"
              fontFamily="monospace"
              flexShrink={0}
              css={{
                textShadow: `
                  0 0 14px rgba(255, 215, 0, 1),
                  0 0 28px rgba(255, 215, 0, 0.6),
                  0 3px 8px rgba(0, 0, 0, 0.95),
                  1px 1px 0 rgba(0, 0, 0, 0.9),
                  2px 2px 0 rgba(0, 0, 0, 0.7)
                `,
                filter: "drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))",
              }}
            >
              【お題】
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              fontWeight={900}
              color="rgb(255, 248, 220)"
              letterSpacing="0.6px"
              fontFamily="monospace"
              css={{
                textShadow: `
                  0 0 16px rgba(255, 215, 0, 0.9),
                  0 0 32px rgba(255, 215, 0, 0.6),
                  0 0 48px rgba(255, 215, 0, 0.3),
                  0 4px 12px rgba(0, 0, 0, 0.95),
                  1px 1px 0 rgba(0, 0, 0, 0.95),
                  2px 2px 0 rgba(0, 0, 0, 0.9),
                  3px 3px 0 rgba(0, 0, 0, 0.7)
                `,
                lineHeight: "1.3",
                wordBreak: "break-word",
              }}
            >
              {topicText}
            </Text>
          </Box>
        </Tooltip>
      ) : null}
    </Box>
  );
}
