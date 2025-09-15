"use client";
import { Box, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import Tooltip from "@/components/ui/Tooltip";

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
        if (topicRef.current) {
          gsap.killTweensOf(topicRef.current);
          gsap.set(topicRef.current, { clearProps: "scale,y" });
        }
      } catch (e) {
        // ignore
      }
    };
  }, [roomStatus, canStartSorting, text, icon]);

  // お題テキスト変更時のぴょーん！アニメーション
  useEffect(() => {
    if (!topicRef.current || !topicText) return;

    // お題テキストが変更された場合のみアニメーション
    if (previousTopicText.current !== null && previousTopicText.current !== topicText) {
      const topicEl = topicRef.current;

      // reduced-motion の尊重
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  }, [topicText]);

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={{ base: "12px", md: "16px" }}
      left={{ base: "20px", md: "24px" }}
      zIndex={70}
      css={{
        pointerEvents: "none",
      }}
    >
      <Box
        display="flex"
        alignItems="flex-start"
        gap={{ base: 2, md: 3 }}
        px={{ base: 3, md: 4 }}
        py={{ base: 2, md: 3 }}
        bg="rgba(20,23,34,0.9)"
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha60}`}
        borderRadius={0}
        css={{
          boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
          backdropFilter: "blur(8px) saturate(1.1)",
          maxWidth: "min(92vw, 520px)",
          transition: "width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)", // スムーズな幅変更
          ["@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)" as any]: {
            maxWidth: "min(92vw, 560px)",
          },
        }}
      >
        <Text as="span" ref={iconRef} fontSize="lg" display="inline-block">
          {icon}
        </Text>
        <Box display="flex" flexDirection="column" gap={{ base: 0.5, md: 1 }}>
          <Text
            ref={textRef}
            fontSize={{ base: "sm", md: "md" }}
            fontWeight={800}
            color={UI_TOKENS.COLORS.whiteAlpha95}
            textShadow="1px 1px 0px rgba(0,0,0,0.6)"
            letterSpacing="0.5px"
            fontFamily="monospace"
            css={{
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "min(88vw, 520px)",
            }}
          >
{text}
          </Text>
          {topicText ? (
            <Tooltip content={topicText} openDelay={200} showArrow>
              <Text
                ref={topicRef}
                fontSize={{ base: "xs", md: "sm" }}
                color="#FFD700" // ゴールド色で目立たせる
                letterSpacing="0.3px"
                fontFamily="monospace"
                fontWeight={700} // 太字で強調
                textShadow="1px 1px 2px rgba(0,0,0,0.8)" // 輪郭を強く
                css={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  maxWidth: "min(82vw, 480px)",
                }}
              >
                <Text as="span" fontWeight={800} color="white" mr={2}>
                  【お題】
                </Text>
                {topicText}
              </Text>
            </Tooltip>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
