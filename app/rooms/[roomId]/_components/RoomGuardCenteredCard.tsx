"use client";

import { UI_TOKENS } from "@/theme/layout";
import { Box, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

type RoomGuardCenteredCardProps = {
  children: ReactNode;
  maxW?: BoxProps["maxW"];
};

export function RoomGuardCenteredCard({
  children,
  maxW = { base: "90%", md: "520px" },
}: RoomGuardCenteredCardProps) {
  return (
    <Box
      h="100dvh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
      bg="rgba(8,9,15,1)"
    >
      <Box
        position="relative"
        border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
        bg="rgba(8,9,15,0.9)"
        color={UI_TOKENS.COLORS.textBase}
        px={{ base: 6, md: 8 }}
        py={{ base: 6, md: 7 }}
        maxW={maxW}
        _before={{
          content: '""',
          position: "absolute",
          inset: "8px",
          border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
          pointerEvents: "none",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

