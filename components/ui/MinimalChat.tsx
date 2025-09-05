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
          transition="all 0.15s ease"
          _hover={{
            transform: "translateY(-1px)",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.38), 0 3px 0 rgba(0,0,0,0.25)",
          }}
          _active={{ 
            transform: "translateY(0)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 0 rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.3)",
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
          width={{ base: "min(92vw, 360px)", md: "420px" }}
          height={{ base: "50vh", md: "480px" }}
          zIndex={21}
          borderRadius="0" // ルーム作成と同じ角ばり
          overflow="hidden"
          bg="rgba(8,9,15,0.95)" // ルーム作成と同じリッチブラック
          border="3px solid rgba(255,255,255,0.9)" // ドラクエ風太ボーダー
          boxShadow="inset 0 3px 0 rgba(255,255,255,0.08), inset 0 -3px 0 rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)" // 製品レベル立体感
          display="flex"
          flexDirection="column"
        >
          <Chat roomId={roomId} />
        </Box>
      )}
    </>
  );
}
