"use client";

import React from "react";
import { Box } from "@chakra-ui/react";

import { UI_TOKENS, UNIFIED_LAYOUT } from "@/theme/layout";

const BOARD_FRAME_STYLES = {
  containerType: "inline-size",
  [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
    gap: "8px",
    padding: "8px 12px",
    "& > *": {
      minWidth: UNIFIED_LAYOUT.DPI_125.CARD.WIDTH.base,
    },
  },
  [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
    gap: `${UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP} !important`,
    rowGap: `${UNIFIED_LAYOUT.DPI_150.SPACING.ROW_GAP} !important`,
    padding: `${UNIFIED_LAYOUT.DPI_150.SPACING.COMPONENT_PADDING} !important`,
    minHeight: "auto !important",
    alignContent: "flex-start !important",
    "& > *": {
      minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
      maxWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
    },
    [`@media (min-width: 768px)`]: {
      "& > *": {
        minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
        maxWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
      },
    },
  },
  "@media (pointer: coarse) and (min-width: 768px)": {
    gap: "clamp(12px, 2.8vw, 24px)",
    padding: "clamp(12px, 2.8vw, 24px)",
    touchAction: "none",
    overscrollBehavior: "contain",
    WebkitTouchCallout: "none",
    userSelect: "none",
  },
  [`@media ${UNIFIED_LAYOUT.BREAKPOINTS.MOBILE}`]: {
    gap: "10px",
    padding: "12px",
  },
  "@container (max-width: 600px)": {
    gap: "6px",
    padding: "8px",
  },
} as const;

function BoardFrameBase({
  isActive,
  children,
  containerRef,
}: {
  isActive: boolean;
  children: React.ReactNode;
  containerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Box
      ref={containerRef}
      borderWidth="0"
      border="borders.retrogameThin"
      borderColor={UI_TOKENS.COLORS.whiteAlpha90}
      borderRadius={0}
      padding={{ base: 3, md: 4 }}
      minHeight="auto"
      width="100%"
      maxWidth="var(--board-max-width)"
      marginInline="auto"
      display="flex"
      flexWrap="wrap"
      justifyContent="center"
      alignContent="flex-start"
      alignItems="flex-start"
      gap={UNIFIED_LAYOUT.SPACING.CARD_GAP}
      transition="background-color 0.28s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.28s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.28s cubic-bezier(0.4, 0, 0.2, 1)"
      data-drop-target={isActive ? "true" : "false"}
      css={BOARD_FRAME_STYLES}
    >
      <Box width="100%" css={{ display: "contents" }}>
        {children}
      </Box>
    </Box>
  );
}

export const BoardFrame = React.memo(BoardFrameBase);
BoardFrame.displayName = "CentralBoardFrame";
