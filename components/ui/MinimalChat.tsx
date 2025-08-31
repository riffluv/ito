"use client";
import React from "react";
import { Box, IconButton } from "@chakra-ui/react";
import { ChatPanel as Chat } from "@/components/ui/ChatPanelImproved";
import { CHAT_FAB_OFFSET_MOBILE, CHAT_FAB_OFFSET_DESKTOP, CHAT_PANEL_BOTTOM_MOBILE, CHAT_PANEL_BOTTOM_DESKTOP } from "@/lib/ui/layout";

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
          css={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, rgba(139,115,85,0.9), rgba(160,133,91,0.9))",
            color: "rgba(0,0,0,0.9)",
            border: "1px solid rgba(160,133,91,0.7)",
            boxShadow:
              "0 8px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.35)",
          }}
        >
          💬
        </IconButton>
      </Box>

      {open && (
        <Box
          position="fixed"
          right={{ base: 3, md: 5 }}
          bottom={{ base: CHAT_PANEL_BOTTOM_MOBILE, md: CHAT_PANEL_BOTTOM_DESKTOP }}
          width={{ base: "min(92vw, 360px)", md: "420px" }}
          height={{ base: "50vh", md: "480px" }}
          zIndex={21}
          borderRadius="16px"
          overflow="hidden"
          bgGradient="panelWood"
          borderWidth="2px"
          borderColor="woodBorder"
          css={{
            backdropFilter: "blur(10px)",
            boxShadow: "var(--shadows-panelWood)",
          }}
        >
          <Chat roomId={roomId} />
        </Box>
      )}
    </>
  );
}
