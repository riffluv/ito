"use client";
import { ChatPanel as Chat } from "@/components/ui/ChatPanelImproved";
import {
  CHAT_FAB_OFFSET_DESKTOP,
  CHAT_FAB_OFFSET_MOBILE,
  CHAT_PANEL_BOTTOM_DESKTOP,
  CHAT_PANEL_BOTTOM_MOBILE,
} from "@/lib/ui/layout";
import { Box } from "@chakra-ui/react";
import IconButtonDQ from "@/components/ui/IconButtonDQ";
import { UI_TOKENS } from "@/theme/layout";
import React from "react";
import type { PlayerDoc } from "@/lib/types";

interface MinimalChatProps {
  roomId: string;
  players?: (PlayerDoc & { id: string })[];
  hostId?: string | null;
}

export default function MinimalChat({
  roomId,
  players = [],
  hostId = null,
}: MinimalChatProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
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

      {open && (
        <Box
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
          }}
          zIndex={21}
          borderRadius="0"
          overflow="hidden"
          bg="rgba(12,14,20,0.92)"
          border="2px solid rgba(255,255,255,0.75)"
          css={{
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)",
            background:
              "linear-gradient(135deg, rgba(12,14,20,0.95) 0%, rgba(18,20,28,0.92) 100%)",
          }}
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
