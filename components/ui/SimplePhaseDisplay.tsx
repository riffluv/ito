"use client";
import { Box, Text, chakra } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import Tooltip from "@/components/ui/Tooltip";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { scaleForDpi } from "@/components/ui/scaleForDpi";

const phaseAurora = keyframes`
  0% { transform: translateX(0px) translateY(0px); opacity: 0.55; }
  45% { transform: translateX(calc(6px * var(--dpi-scale))) translateY(calc(-3px * var(--dpi-scale))); opacity: 0.75; }
  100% { transform: translateX(calc(-5px * var(--dpi-scale))) translateY(calc(2px * var(--dpi-scale))); opacity: 0.5; }
`;

const phaseVeil = keyframes`
  0% { transform: rotate(-1.5deg) translateY(calc(-6px * var(--dpi-scale))); opacity: 0.22; }
  35% { transform: rotate(-0.2deg) translateY(calc(-2px * var(--dpi-scale))); opacity: 0.30; }
  65% { transform: rotate(1.1deg) translateY(calc(-4px * var(--dpi-scale))); opacity: 0.18; }
  100% { transform: rotate(-1.5deg) translateY(calc(-6px * var(--dpi-scale))); opacity: 0.24; }
`;

const topicGlow = keyframes`
  0% { transform: translate(-40%, -10%) rotate(18deg); opacity: 0.4; }
  35% { transform: translate(30%, -6%) rotate(18deg); opacity: 0.75; }
  55% { transform: translate(60%, -4%) rotate(18deg); opacity: 0.5; }
  100% { transform: translate(120%, -8%) rotate(18deg); opacity: 0.35; }
`;

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
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const topicRef = useRef<HTMLDivElement>(null);
  const previousStatus = useRef<string>(roomStatus);
  const previousCanStart = useRef<boolean>(canStartSorting);
  const previousTopicText = useRef<string | null>(topicText);

  const { text, icon } = getPhaseInfo(roomStatus, canStartSorting);

  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const prefersReduced = useReducedMotionPreference();

  // フェーズ変更時のGSAPアニメーション
  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    const iconEl = iconRef.current;
    const topicEl = topicRef.current;

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
        if (topicEl) {
          gsap.killTweensOf(topicEl);
          gsap.set(topicEl, { clearProps: "scale,y" });
        }
      } catch {
        // ignore
      }
    };

    if (!container || !textEl || !iconEl) {
      return cleanup;
    }

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
          duration: 0.58,
          ease: "back.out(1.7)",
          delay: 0.19,
        });

        tl.to(iconEl, {
          rotation: 357,
          duration: 0.76,
          ease: "elastic.out(1, 0.5)",
          delay: 0.38,
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
        duration: 0.17,
        ease: "power2.in",
      })
        .to(
          iconEl,
          {
            opacity: 0,
            rotation: "-=173",
            scale: 0.5,
            duration: 0.18,
            ease: "power2.in",
          },
          "-=0.17"
        )
        // ボックス全体を軽くパルス
        .to(container, {
          scale: 1.05,
          duration: 0.09,
          ease: "power2.out",
        })
        .to(container, {
          scale: 1,
          duration: 0.11,
          ease: "power2.out",
        })
        // 新しいコンテンツをフェードイン
        .to(textEl, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.28,
          ease: "back.out(1.5)",
        })
        .to(
          iconEl,
          {
            opacity: 1,
            rotation: "+=354",
            scale: 1,
            duration: 0.37,
            ease: "elastic.out(1, 0.6)",
          },
          "-=0.19"
        )
        // 完了時の軽やかなバウンス
        .to(container, {
          y: -3,
          duration: 0.14,
          ease: "power2.out",
        })
        .to(container, {
          y: 0,
          duration: 0.18,
          ease: "bounce.out",
        });
    }

    previousStatus.current = roomStatus;
    previousCanStart.current = canStartSorting;

    return cleanup;
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
          duration: 0.08,
          ease: "power2.in",
        })
        .to(topicEl, {
          scale: 1.15,
          y: -6,
          duration: 0.27,
          ease: "back.out(1.8)",
        })
        .to(topicEl, {
          scale: 1,
          y: 0,
          duration: 0.36,
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
      top={{ base: scaleForDpi("8px"), md: scaleForDpi("12px") }}
      left={{ base: scaleForDpi("16px"), md: scaleForDpi("20px") }}
      right={{ base: scaleForDpi("16px"), md: scaleForDpi("20px") }}
      zIndex={70}
      display="flex"
      flexDirection="column"
      gap={{ base: scaleForDpi("7px"), md: scaleForDpi("9px") }}
      css={{
        pointerEvents: "none",
        isolation: "isolate",
        '&::before': {
          content: "''",
          position: "absolute",
          inset: `${scaleForDpi("-18px")} ${scaleForDpi("-24px")}`,
          background: 'radial-gradient(circle at 30% 15%, rgba(120, 180, 255, 0.08), transparent 55%)',
          filter: `blur(${scaleForDpi("18px")})`,
          opacity: 0.8,
          animation: `${phaseAurora} 11.8s ease-in-out infinite`,
          pointerEvents: 'none',
        },
        '&::after': {
          content: "''",
          position: "absolute",
          inset: `${scaleForDpi("-10px")} ${scaleForDpi("-18px")}`,
          background: 'linear-gradient(137deg, rgba(90,120,220,0.08) 0%, rgba(40,65,160,0.12) 60%, rgba(12, 20, 60, 0.0) 100%)',
          transform: `rotate(-1.5deg) translateY(${scaleForDpi("-6px")})`,
          animation: `${phaseVeil} 16.4s cubic-bezier(0.32, 0.22, 0.18, 1) infinite`,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '&::before': { animation: 'none', opacity: 0.45 },
          '&::after': { animation: 'none', opacity: 0.12 },
        },
      }}
    >
      {/* フェーズアナウンス（シームレス・大きく・真っ白） */}
      <Box
        display="flex"
        alignItems="center"
        gap={{ base: scaleForDpi("9px"), md: scaleForDpi("11px") }}
        minW={0}
      >
        <chakra.span
          ref={iconRef}
          fontSize={{
            base: "calc(var(--chakra-fontSizes-lg) * var(--dpi-scale))",
            md: "calc(var(--chakra-fontSizes-xl) * var(--dpi-scale))",
          }}
          display="inline-block"
          flexShrink={0}
          css={{
            filter: `drop-shadow(0 ${scaleForDpi("3px")} ${scaleForDpi("6px")} rgba(0, 0, 0, 0.9)) drop-shadow(0 ${scaleForDpi("6px")} ${scaleForDpi("12px")} rgba(0, 0, 0, 0.7))`,
          }}
        >
          {icon}
        </chakra.span>
        <Text
          ref={textRef}
          fontSize={{
            base: "calc(var(--chakra-fontSizes-sm) * var(--dpi-scale))",
            md: "calc(var(--chakra-fontSizes-md) * var(--dpi-scale))",
          }}
          truncate
          minW={0}
          fontWeight={700}
          color="rgb(255, 255, 255)"
          letterSpacing={scaleForDpi("0.38px")}
          fontFamily="monospace"
          css={{
            textShadow: `
              0 ${scaleForDpi("3px")} ${scaleForDpi("10px")} rgba(0, 0, 0, 0.95),
              0 ${scaleForDpi("6px")} ${scaleForDpi("20px")} rgba(0, 0, 0, 0.8),
              ${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(0, 0, 0, 0.9),
              ${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0, 0, 0, 0.7)
            `,
            filter: `drop-shadow(0 ${scaleForDpi("2px")} ${scaleForDpi("6px")} rgba(0, 0, 0, 0.8))`,
          }}
        >
          {text}
        </Text>
      </Box>

      {/* お題バッジ（控えめゴールド・影あり） */}
      {topicText ? (
        <Tooltip content={topicText} openDelay={200} showArrow>
          <Box
            ref={topicRef}
            display="inline-flex"
            alignItems="center"
            gap={{ base: scaleForDpi("9px"), md: scaleForDpi("11px") }}
            px={{ base: scaleForDpi("11px"), md: scaleForDpi("13px") }}
            py={{ base: scaleForDpi("7px"), md: scaleForDpi("9px") }}
            position="relative"
            alignSelf="flex-start"
            css={{
              background: "linear-gradient(137deg, rgba(255, 215, 0, 0.18) 0%, rgba(255, 165, 0, 0.22) 100%)",
              backdropFilter: "blur(10px) saturate(1.2)",
              borderRadius: scaleForDpi("3px"),
              border: "1px solid rgba(255, 215, 0, 0.35)",
              boxShadow: `
                0 ${scaleForDpi("4px")} ${scaleForDpi("16px")} rgba(0, 0, 0, 0.7),
                0 ${scaleForDpi("8px")} ${scaleForDpi("32px")} rgba(0, 0, 0, 0.5),
                0 0 ${scaleForDpi("24px")} rgba(255, 215, 0, 0.2)
              `,
              overflow: 'hidden',
              '&::after': {
                content: "''",
                position: 'absolute',
                inset: '-120% -40%',
                background: 'radial-gradient(ellipse at 48% 52%, rgba(252, 252, 252, 0.32), rgba(248, 210, 0, 0.06) 41%, rgba(255, 220, 10, 0.03) 58%, transparent 69%)',
                transform: 'translate(-40%, -10%) rotate(18deg)',
                animation: `${topicGlow} 8.6s linear infinite`,
                mixBlendMode: 'screen',
                opacity: 0.55,
                pointerEvents: 'none',
              },
              '@media (prefers-reduced-motion: reduce)': {
                '&::after': { animation: 'none', opacity: 0.2 },
              },
            }}
          >
            <Text
              as="span"
              fontSize={{
                base: "calc(var(--chakra-fontSizes-sm) * var(--dpi-scale))",
                md: "calc(var(--chakra-fontSizes-md) * var(--dpi-scale))",
              }}
              fontWeight={900}
              color="rgb(255, 255, 255)"
              letterSpacing={scaleForDpi("0.93px")}
              fontFamily="monospace"
              flexShrink={0}
              css={{
                textShadow: `
                  0 0 ${scaleForDpi("12px")} rgba(255, 215, 0, 0.8),
                  0 ${scaleForDpi("2px")} ${scaleForDpi("6px")} rgba(0, 0, 0, 0.9),
                  ${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(0, 0, 0, 0.85)
                `,
              }}
            >
              【お題】
            </Text>
            <Text
              fontSize={{
                base: "calc(var(--chakra-fontSizes-md) * var(--dpi-scale))",
                md: "calc(var(--chakra-fontSizes-lg) * var(--dpi-scale))",
              }}
              fontWeight={800}
              color="rgb(255, 248, 220)"
              letterSpacing={scaleForDpi("0.57px")}
              fontFamily="monospace"
              css={{
                textShadow: `
                  0 0 ${scaleForDpi("14px")} rgba(255, 215, 0, 0.7),
                  0 ${scaleForDpi("3px")} ${scaleForDpi("10px")} rgba(0, 0, 0, 0.95),
                  ${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(0, 0, 0, 0.9)
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
