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
            // 🔮 ARTIFACT-STYLE MYSTICAL CHAT BUTTON
            width: "64px",
            height: "64px",
            borderRadius: "16px", // 円形ではなく角丸四角で高級感
            background: `
              linear-gradient(135deg, 
                rgba(139, 92, 246, 0.25) 0%,
                rgba(168, 85, 247, 0.2) 25%,
                rgba(147, 51, 234, 0.22) 50%,
                rgba(109, 40, 217, 0.2) 75%,
                rgba(94, 39, 176, 0.25) 100%
              )
            `,
            border: "2px solid rgba(168, 85, 247, 0.6)",
            color: "#a78bfa",
            fontSize: "1.5rem",
            boxShadow: `
              0 16px 48px rgba(94, 39, 176, 0.4),
              0 8px 24px rgba(0, 0, 0, 0.6),
              inset 0 2px 0 rgba(168, 85, 247, 0.3),
              inset 0 -2px 0 rgba(67, 56, 202, 0.4)
            `,
            backdropFilter: "blur(28px) saturate(1.4)",
            transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            _hover: {
              transform: "translateY(-4px) scale(1.05)",
              background: `
                linear-gradient(135deg, 
                  rgba(139, 92, 246, 0.35) 0%,
                  rgba(168, 85, 247, 0.3) 25%,
                  rgba(147, 51, 234, 0.32) 50%,
                  rgba(109, 40, 217, 0.3) 75%,
                  rgba(94, 39, 176, 0.35) 100%
                )
              `,
              boxShadow: `
                0 24px 64px rgba(94, 39, 176, 0.5),
                0 12px 32px rgba(0, 0, 0, 0.7),
                inset 0 2px 0 rgba(168, 85, 247, 0.4),
                0 0 40px rgba(168, 85, 247, 0.3)
              `,
              color: "#c4b5fd",
            },
            _active: {
              transform: "translateY(-2px) scale(1.02)",
            },
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
          borderRadius="20px"
          overflow="hidden"
          css={{
            // 🔮 ARTIFACT-STYLE MYSTICAL CHAT PANEL
            background: `
              linear-gradient(135deg, 
                rgba(139, 92, 246, 0.12) 0%,
                rgba(168, 85, 247, 0.08) 25%,
                rgba(147, 51, 234, 0.1) 50%,
                rgba(109, 40, 217, 0.08) 75%,
                rgba(94, 39, 176, 0.12) 100%
              )
            `,
            border: "2px solid rgba(168, 85, 247, 0.4)",
            boxShadow: `
              0 32px 64px rgba(94, 39, 176, 0.4),
              0 16px 32px rgba(0, 0, 0, 0.6),
              inset 0 2px 0 rgba(168, 85, 247, 0.2),
              inset 0 -2px 0 rgba(67, 56, 202, 0.3)
            `,
            backdropFilter: "blur(32px) saturate(1.5)",
          }}
        >
          <Chat roomId={roomId} />
        </Box>
      )}
    </>
  );
}
