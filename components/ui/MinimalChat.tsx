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
          width="40px"
          height="40px"
          rounded="lg"
          bg="transparent"
          color={open ? "blue.400" : "gray.400"}
          borderWidth="0"
          fontSize="18px"
          transition="all 0.2s ease"
          _hover={{
            color: open ? "blue.300" : "gray.200",
            transform: "scale(1.1)",
          }}
          _active={{ 
            transform: "scale(0.95)"
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
          rounded="xl"
          overflow="hidden"
          bg="gray.900"
          borderWidth="1px"
          borderColor="gray.700"
          boxShadow="0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)"
          display="flex"
          flexDirection="column"
        >
          <Chat roomId={roomId} />
        </Box>
      )}
    </>
  );
}
