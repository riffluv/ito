"use client";
import { ChatPanel as Chat } from "@/components/ui/ChatPanelImproved";
import {
  CHAT_FAB_OFFSET_DESKTOP,
  CHAT_FAB_OFFSET_MOBILE,
  CHAT_PANEL_BOTTOM_DESKTOP,
  CHAT_PANEL_BOTTOM_MOBILE,
} from "@/lib/ui/layout";
import { Box, IconButton } from "@chakra-ui/react";
import React from "react";

export default function MinimalChat({ roomId }: { roomId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Box
        position="fixed"
        right={{ base: 3, md: 5 }}
        bottom={{ base: CHAT_FAB_OFFSET_MOBILE, md: CHAT_FAB_OFFSET_DESKTOP }}
        zIndex={20}
      >
        <IconButton
          aria-label={open ? "チャットを閉じる" : "チャットを開く"}
          onClick={() => setOpen((v) => !v)}
          width="44px"
          height="44px"
          borderRadius="0" // ドラクエ風角ばり
          bg="rgba(8,9,15,0.9)" // ルーム作成と同じリッチブラック
          color="white"
          border="2px solid rgba(255,255,255,0.9)" // ドラクエ風ボーダー
          fontSize="16px"
          fontWeight="bold"
          boxShadow="inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.25)" // 立体効果
          transition="transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease"
          _hover={{
            transform: "translateY(-1px)",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.38), 0 3px 0 rgba(0,0,0,0.25)",
          }}
          _active={{
            transform: "translateY(0)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 0 rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.3)",
          }}
        >
          {open ? "✕" : "💬"}
        </IconButton>
      </Box>

      {open && (
        <Box
          position="fixed"
          right={{ base: 3, md: 5 }}
          bottom={{
            base: CHAT_PANEL_BOTTOM_MOBILE,
            md: CHAT_PANEL_BOTTOM_DESKTOP,
          }}
          width={{ base: "min(88vw, 320px)", md: "340px" }} // 基本サイズを大幅縮小
          height={{ base: "45vh", md: "400px" }}
          css={{
            // DPI 125%対応：8人カード対応でより小さく
            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
              {
                width: "280px !important", // さらに大幅縮小
                height: "350px !important",
              },
            "@media (min-resolution: 1.25dppx) and (max-width: 768px), screen and (-webkit-device-pixel-ratio: 1.25) and (max-width: 768px)":
              {
                width: "min(85vw, 260px) !important",
                height: "40vh !important",
              },
            
            // DPI 150%対応：8人カード対応で最小サイズ
            "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
              {
                width: "240px !important", // 最小限サイズ
                height: "280px !important", // 高さも最小限
              },
            "@media (min-resolution: 1.5dppx) and (max-width: 768px), screen and (-webkit-device-pixel-ratio: 1.5) and (max-width: 768px)":
              {
                width: "min(80vw, 220px) !important",
                height: "32vh !important",
              },
          }}
          zIndex={21}
          borderRadius="0" // ルーム作成と同じ角ばり
          overflow="hidden"
          bg="rgba(8,9,15,0.95)" // ルーム作成と同じリッチブラック
          border="3px solid rgba(255,255,255,0.9)" // ドラクエ風太ボーダー
          boxShadow="inset 0 3px 0 rgba(255,255,255,0.08), inset 0 -3px 0 rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)" // 製品レベル立体感
          display="flex"
          flexDirection="column"
        >
          {/* 子要素を親の固定高さいっぱいに伸ばすためのラッパー */}
          <Box flex="1 1 auto" height="100%" minH={0}>
            <Chat roomId={roomId} />
          </Box>
        </Box>
      )}
    </>
  );
}
