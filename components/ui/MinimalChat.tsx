"use client";
import React from "react";
import { Box, IconButton } from "@chakra-ui/react";
import { ChatPanel as Chat } from "@/components/ui/ChatPanelImproved";

export default function MinimalChat({ roomId }: { roomId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Box
        position="fixed"
        right={{ base: 3, md: 5 }}
        bottom={{ base: "148px", md: "172px" }}
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
          bottom={{ base: "212px", md: "232px" }}
          width={{ base: "min(92vw, 360px)", md: "420px" }}
          height={{ base: "50vh", md: "480px" }}
          zIndex={21}
          borderRadius="16px"
          overflow="hidden"
          css={{
            background:
              "linear-gradient(180deg, rgba(101,67,33,0.9) 0%, rgba(80,53,26,0.95) 100%)",
            border: "2px solid rgba(160,133,91,0.6)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.7)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Chat roomId={roomId} />
        </Box>
      )}
    </>
  );
}
