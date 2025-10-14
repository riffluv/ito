"use client";
import { ChatPanel as Chat } from "@/components/ui/ChatPanelImproved";
import {
  CHAT_FAB_OFFSET_DESKTOP,
  CHAT_FAB_OFFSET_MOBILE,
  CHAT_PANEL_BOTTOM_DESKTOP,
  CHAT_PANEL_BOTTOM_MOBILE,
} from "@/lib/ui/layout";
import { Box, Image } from "@chakra-ui/react";
import IconButtonDQ from "@/components/ui/IconButtonDQ";
import { UI_TOKENS } from "@/theme/layout";
import { keyframes } from "@emotion/react";
import React from "react";
import type { PlayerDoc } from "@/lib/types";
import useReducedMotionPreference from "@/hooks/useReducedMotionPreference";
import { gsap } from "gsap";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

// 戦績ボタン用アンビエント効果（高頻度版）
const ledgerGlint = keyframes`
  0% { transform: translateX(-140%) rotate(9deg); opacity: 0; }
  8% { transform: translateX(-40%) rotate(9deg); opacity: 0.4; }
  16% { transform: translateX(30%) rotate(9deg); opacity: 0.5; }
  24% { transform: translateX(100%) rotate(9deg); opacity: 0.3; }
  32% { transform: translateX(150%) rotate(9deg); opacity: 0; }

  /* 2周目: すぐ次の光が来る */
  40% { transform: translateX(-140%) rotate(9deg); opacity: 0; }
  48% { transform: translateX(-40%) rotate(9deg); opacity: 0.4; }
  56% { transform: translateX(30%) rotate(9deg); opacity: 0.5; }
  64% { transform: translateX(100%) rotate(9deg); opacity: 0.3; }
  72% { transform: translateX(150%) rotate(9deg); opacity: 0; }

  /* 短い休憩 */
  100% { transform: translateX(150%) rotate(9deg); opacity: 0; }
`;

interface MinimalChatProps {
  roomId: string;
  players?: (PlayerDoc & { id: string })[];
  hostId?: string | null;
  onOpenLedger?: () => void;
  isGameFinished?: boolean;
}

export default function MinimalChat({
  roomId,
  players = [],
  hostId = null,
  onOpenLedger,
  isGameFinished = false,
}: MinimalChatProps) {
  const [open, setOpen] = React.useState(false);
  const prefersReducedMotion = useReducedMotionPreference();
  const [ambientPhase, setAmbientPhase] = React.useState<0 | 1>(0);
  const chatPanelRef = React.useRef<HTMLDivElement>(null);
  const playLedgerOpen = useSoundEffect("ledger_open");

  // アンビエント効果のフェーズ切り替え（高頻度: 800ms）
  React.useEffect(() => {
    if (prefersReducedMotion) return;
    const id = window.setInterval(
      () => setAmbientPhase((prev) => (prev === 0 ? 1 : 0)),
      800 // 超高頻度で常に光っている感じに
    );
    return () => window.clearInterval(id);
  }, [prefersReducedMotion]);

  // チャットパネルの「ぴょこん」アニメーション
  React.useEffect(() => {
    const panel = chatPanelRef.current;
    if (!panel) return;

    if (prefersReducedMotion) {
      // モーション削減時は即座に表示/非表示
      gsap.set(panel, { opacity: open ? 1 : 0, scale: 1, y: 0 });
      return;
    }

    if (open) {
      // 開くアニメーション：下から「ぴょこん」
      gsap.fromTo(
        panel,
        {
          opacity: 0,
          scale: 0.8,
          y: 20,
        },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.35,
          ease: "back.out(1.7)", // 弾むような感じ
        }
      );
    } else {
      // 閉じるアニメーション：下に「すっ」
      gsap.to(panel, {
        opacity: 0,
        scale: 0.9,
        y: 10,
        duration: 0.2,
        ease: "power2.in",
      });
    }
  }, [open, prefersReducedMotion]);

  // 低スペック対応: prefersReducedMotionの時は静的な切り替え（常に明るめ）
  const glowOpacity = prefersReducedMotion
    ? ambientPhase === 1
      ? 0.5
      : 0.35
    : 0.8; // 常時明るめに
  const glowShift = prefersReducedMotion
    ? ambientPhase === 1
      ? "translateX(30%) rotate(12deg)"
      : "translateX(-30%) rotate(12deg)"
    : "translateX(-120%) rotate(12deg)";

  return (
    <>
      {/* チャットトグルボタン */}
      <Box
        position="fixed"
        // さらに外側（画面の右端に寄せる）
        right={{ base: 3, md: 5 }}
        bottom={{ base: CHAT_FAB_OFFSET_MOBILE, md: CHAT_FAB_OFFSET_DESKTOP }}
        zIndex={20}
      >
        <IconButtonDQ
          aria-label={open ? "チャットを閉じる" : "チャットを開く"}
          onClick={() => setOpen((v) => !v)}
          width="44px"
          height="44px"
          borderRadius="0" // ドラクエ風角ばり
          fontSize="16px"
          fontWeight="bold"
          transition={`transform 0.15s ${UI_TOKENS.EASING.standard}`}
          _hover={{
            transform: "translateY(-1px)",
          }}
          _active={{
            transform: "translateY(0)",
          }}
        >
          {open ? "✕" : "💬"}
        </IconButtonDQ>
      </Box>

      {/* 戦績ボタン（チャットトグルの下） */}
      {onOpenLedger && (
        <Box
          position="fixed"
          right={{ base: 3, md: 5 }}
          bottom={{
            base: `calc(${CHAT_FAB_OFFSET_MOBILE} - 58px)`,
            md: `calc(${CHAT_FAB_OFFSET_DESKTOP} - 62px)`,
          }}
          zIndex={20}
          opacity={isGameFinished ? 1 : 0}
          pointerEvents={isGameFinished ? "auto" : "none"}
          transform={isGameFinished ? "translateY(0)" : "translateY(12px)"}
          transition="all 320ms cubic-bezier(.2,1,.3,1)"
        >
          <Box
            as="button"
            onClick={() => {
              playLedgerOpen();
              onOpenLedger();
            }}
            display="flex"
            alignItems="center"
            gap="8px"
            minW="150px"
            height="48px"
            px="14px"
            border="3px solid rgba(214,177,117,0.9)"
            borderRadius="0"
            background="linear-gradient(180deg, rgba(20,23,34,0.98) 0%, rgba(12,14,20,1) 100%)"
            fontFamily="monospace"
            fontSize="15px"
            fontWeight="700"
            letterSpacing="0.08em"
            color="white"
            textShadow="2px 2px 0 rgba(0,0,0,0.9)"
            boxShadow={`
              inset 0 2px 0 rgba(255,255,255,0.12),
              inset 0 -2px 0 rgba(0,0,0,0.5),
              0 4px 8px rgba(0,0,0,0.4),
              2px 2px 0 rgba(0,0,0,0.8)
            `}
            transition={`transform 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}`}
            cursor="pointer"
            position="relative"
            overflow="hidden"
            _hover={{
              background: "linear-gradient(180deg, rgba(25,28,39,0.98) 0%, rgba(15,17,23,1) 100%)",
              transform: "translateY(-1px)",
              boxShadow: `
                inset 0 2px 0 rgba(255,255,255,0.15),
                inset 0 -2px 0 rgba(0,0,0,0.6),
                0 6px 12px rgba(0,0,0,0.5),
                2px 2px 0 rgba(0,0,0,0.9)
              `,
            }}
            _active={{
              transform: "translateY(0)",
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,0.08),
                inset 0 -1px 0 rgba(0,0,0,0.4),
                0 2px 4px rgba(0,0,0,0.3),
                1px 1px 0 rgba(0,0,0,0.7)
              `,
            }}
            css={{
              // アンビエント光効果（高頻度版）
              "&::before": {
                content: '""',
                position: "absolute",
                inset: "-40%",
                background:
                  "radial-gradient(circle at 20% 20%, rgba(214,177,117,0.35), transparent 60%)",
                transform: glowShift,
                ...(prefersReducedMotion
                  ? {
                      transition:
                        "opacity 0.4s ease-in-out, transform 0.4s ease-in-out",
                    }
                  : {
                      animation: `${ledgerGlint} 3.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite`,
                    }),
                pointerEvents: "none",
                mixBlendMode: "screen",
                opacity: glowOpacity,
              },
              // ベース光（常時点灯）
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 50% 50%, rgba(214,177,117,0.08), transparent 80%)",
                pointerEvents: "none",
                mixBlendMode: "screen",
                opacity: 1,
              },
            }}
          >
            <Image
              src="/images/hanepen2.webp"
              alt=""
              boxSize="22px"
              style={{
                filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.8))",
              }}
            />
            <Box as="span">戦績を見る</Box>
          </Box>
        </Box>
      )}

      {open && (
        <Box
          ref={chatPanelRef}
          position="fixed"
          right={{ base: 3, md: 5 }}
          bottom={{
            base: CHAT_PANEL_BOTTOM_MOBILE,
            md: CHAT_PANEL_BOTTOM_DESKTOP,
          }}
          width={{ base: "min(88vw, 320px)", md: "340px" }}
          height={{ base: "36vh", md: "300px" }}
          css={{
            // DPI 125%: さらに低めに（カード・お題との衝突回避）
            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
              {
                width: "280px !important",
                height: "300px !important",
              },
            "@media (min-resolution: 1.25dppx) and (max-width: 768px), screen and (-webkit-device-pixel-ratio: 1.25) and (max-width: 768px)":
              {
                width: "min(85vw, 260px) !important",
                height: "34vh !important",
              },

            // DPI 150%: さらに小さめ
            "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
              {
                width: "240px !important",
                height: "240px !important",
              },
            "@media (min-resolution: 1.5dppx) and (max-width: 768px), screen and (-webkit-device-pixel-ratio: 1.5) and (max-width: 768px)":
              {
                width: "min(80vw, 220px) !important",
                height: "28vh !important",
              },
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)",
            background:
              "linear-gradient(135deg, rgba(12,14,20,0.95) 0%, rgba(18,20,28,0.92) 100%)",
          }}
          zIndex={130}
          borderRadius="0"
          overflow="hidden"
          bg="rgba(12,14,20,0.92)"
          border="2px solid rgba(255,255,255,0.75)"
          display="flex"
          flexDirection="column"
        >
          {/* 子要素を親の固定高さいっぱいに伸ばすためのラッパー */}
          <Box flex="1 1 auto" height="100%" minH={0}>
            <Chat roomId={roomId} players={players} hostId={hostId} />
          </Box>
        </Box>
      )}
    </>
  );
}
