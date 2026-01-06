"use client";

import dynamic from "next/dynamic";
import React, { type ComponentProps } from "react";
import { Box, VisuallyHidden } from "@chakra-ui/react";

import { UNIFIED_LAYOUT } from "@/theme/layout";

import { boardCollisionDetection } from "./boardCollisionDetection";
import { InteractiveBoard } from "./InteractiveBoard";
import { StaticBoard } from "./StaticBoard";

const GameResultOverlay = dynamic(
  () =>
    import("@/components/ui/GameResultOverlay").then(
      (mod) => mod.GameResultOverlay
    ),
  { loading: () => null, ssr: false }
);

const StreakBanner = dynamic(
  () => import("@/components/ui/StreakBanner").then((mod) => mod.StreakBanner),
  { loading: () => null }
);

type InteractiveBoardProps = ComponentProps<typeof InteractiveBoard>;
type StaticBoardProps = ComponentProps<typeof StaticBoard>;

export type CentralCardBoardViewProps = {
  activeBoard: boolean;
  a11yLiveMessage: string;
  interactive: Omit<InteractiveBoardProps, "collisionDetection">;
  static: StaticBoardProps;
  showResultOverlay: boolean;
  revealedAt: unknown;
  failed: boolean;
  streak: {
    currentStreak: number;
    isVisible: boolean;
    onComplete: () => void;
  };
};

export function CentralCardBoardView({
  activeBoard,
  a11yLiveMessage,
  interactive,
  static: staticProps,
  showResultOverlay,
  failed,
  revealedAt,
  streak,
}: CentralCardBoardViewProps) {
  return (
    <Box
      data-board-root
      h="100%"
      display="flex"
      flexDirection="column"
      border="none"
      borderWidth="0"
      css={{
        background: "transparent",
        position: "relative",
        "@media (pointer: coarse)": {
          touchAction: "pan-y",
          WebkitTouchCallout: "none",
          userSelect: "none",
          overscrollBehavior: "contain",
        },
      }}
    >
      <VisuallyHidden aria-live="polite">{a11yLiveMessage}</VisuallyHidden>

      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="flex-start"
        overflow="visible"
        position="relative"
        minHeight={0}
        pt={{ base: "8vh", md: "10vh" }}
        pb={{ base: 2, md: 3 }}
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            paddingTop: "9vh !important",
            paddingBottom: "0.75rem !important",
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
            paddingTop: "10vh !important",
            paddingBottom: "0.5rem !important",
          },
        }}
      >
        {activeBoard ? (
          <InteractiveBoard
            {...interactive}
            collisionDetection={boardCollisionDetection}
          />
        ) : (
          <StaticBoard {...staticProps} />
        )}
      </Box>

      {showResultOverlay && (
        <GameResultOverlay failed={failed} mode="overlay" revealedAt={revealedAt} />
      )}

      <StreakBanner
        streak={streak.currentStreak}
        isVisible={streak.isVisible}
        onComplete={streak.onComplete}
      />
    </Box>
  );
}

