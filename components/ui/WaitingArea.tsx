"use client";
import { useDroppable } from "@dnd-kit/core";
import WaitingAreaCard from "@/components/ui/WaitingAreaCard";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text, VStack } from "@chakra-ui/react";
import { useId, useMemo } from "react";

export interface WaitingAreaProps {
  players: (PlayerDoc & { id: string })[];
  title?: string;
  isDraggingEnabled?: boolean;
  meId?: string;
  displayMode?: "full" | "minimal";
  returnDropZoneId?: string;
  hideClues?: boolean;
}

export default function WaitingArea({
  players,
  title = "",
  isDraggingEnabled = false,
  meId,
  displayMode = "full",
  returnDropZoneId,
  hideClues = false,
}: WaitingAreaProps) {
  const generatedDropId = useId();
  const dropZoneId = returnDropZoneId ?? `waiting-area-${generatedDropId.replace(/:/g, "")}`;
  const dropZoneEnabled = Boolean(returnDropZoneId && isDraggingEnabled);
  const { setNodeRef: setReturnZoneRef } = useDroppable({
    id: dropZoneId,
    disabled: !dropZoneEnabled,
  });

  const dropZoneCss = useMemo(() => ({
    minHeight: dropZoneEnabled && players.length === 0 ? "72px" : undefined,
    ...(dropZoneEnabled && players.length === 0 ? {
      flex: "1 1 100%",
      minWidth: "100%",
      width: "100%"
    } : {}),
    [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
      gap: "8px",
    },
    ['@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)']: {
      gap: `${UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP} !important`,
    },
    ['@media (max-width: 480px)']: {
      gap: "10px",
    },
    ['@media (max-width: 360px)']: {
      gap: "6px",
    },
  }), [dropZoneEnabled, players.length]);

  return (
    <VStack
      width="100%"
      mx="auto"
      mt={{ base: 4, md: 6 }}
      gap={4}
      borderRadius="lg"
      bg="transparent"
      css={{
        boxShadow: "none",
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
          marginTop: "0.5rem !important",
        },
      }}
    >
      {title && (
        <Text
          textAlign="center"
          fontWeight={600}
          fontSize={{ base: "13px", md: "14px" }}
          letterSpacing="0.5px"
          color="var(--chakra-colors-whiteAlpha-900)"
          mb={3}
          fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
        >
          {title}
        </Text>
      )}

      <Box
        ref={dropZoneEnabled ? setReturnZoneRef : undefined}
        position="relative"
        width="100%"
        minW={dropZoneEnabled && players.length === 0 ? "100%" : undefined}
        display="flex"
        flexWrap="nowrap"
        justifyContent="center"
        alignItems={players.length === 0 ? "center" : "flex-start"}
        gap={UNIFIED_LAYOUT.SPACING.CARD_GAP}
        overflowX="auto"
        overflowY="hidden"
        bg="transparent"
        data-drop-enabled={dropZoneEnabled ? "true" : undefined}
        data-drop-over={dropZoneEnabled ? "true" : undefined}
        css={dropZoneCss}
      >
        {displayMode === "minimal"
          ? players.filter((p) => p.id === meId).map((p) => (
              <WaitingAreaCard
                key={p.id}
                player={p}
                isDraggingEnabled={isDraggingEnabled}
                meId={meId}
                optimisticReset={hideClues}
              />
            ))
          : players.map((p) => (
              <WaitingAreaCard
                key={p.id}
                player={p}
                isDraggingEnabled={isDraggingEnabled}
                meId={meId}
                optimisticReset={hideClues}
              />
            ))}
      </Box>

      <Box as="style">{`@keyframes pulseW{0%{opacity:.85}100%{opacity:1}}`}</Box>
    </VStack>
  );
}
