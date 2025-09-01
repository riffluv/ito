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
          width="56px"
          height="56px"
          rounded="full"
          bg={open ? "accent" : "surfaceOverlay"}
          color={open ? "white" : "fgDefault"}
          borderWidth="1px"
          borderColor={open ? "accent" : "borderDefault"}
          fontSize="1.35rem"
          shadow={open ? "md" : "sm"}
          transition="background-color .25s var(--easings-standard), color .25s, transform .25s, box-shadow .25s, border-color .25s"
          _hover={{
            bg: open ? "accentHover" : "surfaceRaised",
            shadow: open ? "lg" : "md",
            transform: "translateY(-3px)",
          }}
          _active={{ transform: "translateY(-1px)", shadow: "sm" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "focusRing",
            outlineOffset: "2px",
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
          bg="surfaceOverlay"
          borderWidth="1px"
          borderColor="borderDefault"
          shadow="lg"
          display="flex"
          flexDirection="column"
        >
          <Chat roomId={roomId} />
        </Box>
      )}
    </>
  );
}
