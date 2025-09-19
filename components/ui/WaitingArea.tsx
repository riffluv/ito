"use client";
import { useDroppable } from "@dnd-kit/core";
import WaitingAreaCard from "@/components/ui/WaitingAreaCard";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import { Box, Text, VStack, VisuallyHidden } from "@chakra-ui/react";
import { useId, useMemo } from "react";

export interface WaitingAreaProps {
  players: (PlayerDoc & { id: string })[];
  title?: string;
  isDraggingEnabled?: boolean;
  meId?: string;
  displayMode?: "full" | "minimal";
  returnDropZoneId?: string;
  isReturnActive?: boolean;
}

export default function WaitingArea({
  players,
  title = "",
  isDraggingEnabled = false,
  meId,
  displayMode = "full",
  returnDropZoneId,
  isReturnActive = false,
}: WaitingAreaProps) {
  const generatedDropId = useId();
  const dropZoneId = returnDropZoneId ?? `waiting-area-${generatedDropId.replace(/:/g, "")}`;
  const dropZoneEnabled = Boolean(returnDropZoneId && isDraggingEnabled);
  const { setNodeRef: setReturnZoneRef, isOver: isReturnZoneOver } = useDroppable({
    id: dropZoneId,
    disabled: !dropZoneEnabled,
  });

  const showEmptyDropHint = dropZoneEnabled && players.length === 0;
  const showActiveGlow = dropZoneEnabled && isReturnActive;
  const showAmbientGlow = dropZoneEnabled && !isReturnActive && showEmptyDropHint;
  const showReturnCue = showActiveGlow && players.length <= 1;

  const highlightVisuals = useMemo(() => {
    if (!dropZoneEnabled) {
      return {
        containerBackground: "transparent",
        boxShadow: "none",
        inset: "-10px",
        overlayBackground: "transparent",
        overlayBorder: "1px dashed transparent",
        overlayOpacity: 0,
      };
    }

    if (showActiveGlow) {
      return {
        containerBackground: "linear-gradient(180deg, rgba(67, 97, 238, 0.16) 0%, rgba(191, 219, 254, 0.06) 100%)",
        boxShadow: "0 18px 36px rgba(30, 64, 175, 0.35)",
        inset: "-14px",
        overlayBackground: "rgba(59, 130, 246, 0.18)",
        overlayBorder: `1px dashed ${UI_TOKENS.COLORS.whiteAlpha80}`,
        overlayOpacity: 1,
      };
    }

    if (showAmbientGlow) {
      return {
        containerBackground: "rgba(148, 163, 184, 0.10)",
        boxShadow: "0 12px 24px rgba(15, 23, 42, 0.28)",
        inset: "-10px",
        overlayBackground: "transparent",
        overlayBorder: `1px dashed ${UI_TOKENS.COLORS.whiteAlpha40}`,
        overlayOpacity: 1,
      };
    }

    return {
      containerBackground: "transparent",
      boxShadow: "none",
      inset: "-10px",
      overlayBackground: "transparent",
      overlayBorder: "1px dashed transparent",
      overlayOpacity: 0,
    };
  }, [dropZoneEnabled, showActiveGlow, showAmbientGlow]);

  const dropBoxStyles = useMemo(() => ({
    minHeight: showEmptyDropHint ? "72px" : undefined,
    transition: "background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
    ...(dropZoneEnabled
      ? {
          borderRadius: "24px",
          background: highlightVisuals.containerBackground,
          boxShadow: highlightVisuals.boxShadow,
          '&::before': {
            content: '""',
            position: "absolute",
            inset: highlightVisuals.inset,
            borderRadius: "28px",
            background: highlightVisuals.overlayBackground,
            border: highlightVisuals.overlayBorder,
            opacity: highlightVisuals.overlayOpacity,
            transition: "opacity 0.2s ease, background 0.2s ease, inset 0.2s ease",
            pointerEvents: "none",
          },
        }
      : {}),
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
  }), [dropZoneEnabled, highlightVisuals, showEmptyDropHint]);

  const dropHintLabel = showReturnCue
    ? "下方向にドラッグで手札に戻せます"
    : "戻したカードはここに並びます";

  return (
    <VStack
      width="100%"
      maxWidth="600px"
      mx="auto"
      mt={{ base: 4, md: 6 }}
      p={{ base: 3, md: 4 }}
      gap={4}
      borderRadius="lg"
      css={{
        background: "transparent",
        boxShadow: "none",
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
          marginTop: "0.5rem !important",
          padding: "0.5rem !important",
        },
      }}
    >
      {title && (
        <Text
          textAlign="center"
          fontWeight={600}
          fontSize={{ base: "13px", md: "14px" }}
          letterSpacing="0.5px"
          color={UI_TOKENS.COLORS.whiteAlpha95}
          mb={3}
          fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
          textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        >
          {title}
        </Text>
      )}

      <Box
        ref={dropZoneEnabled ? setReturnZoneRef : undefined}
        position="relative"
        width="100%"
        display="flex"
        flexWrap="wrap"
        justifyContent="center"
        alignItems={players.length === 0 ? "center" : "flex-start"}
        gap={UNIFIED_LAYOUT.SPACING.CARD_GAP}
        data-drop-enabled={dropZoneEnabled ? "true" : undefined}
        data-drop-over={dropZoneEnabled && isReturnZoneOver ? "true" : undefined}
        css={dropBoxStyles}
      >
        {displayMode === "minimal"
          ? players.filter((p) => p.id === meId).map((p) => (
              <WaitingAreaCard
                key={p.id}
                player={p}
                isDraggingEnabled={isDraggingEnabled}
                meId={meId}
              />
            ))
          : players.map((p) => (
              <WaitingAreaCard
                key={p.id}
                player={p}
                isDraggingEnabled={isDraggingEnabled}
                meId={meId}
              />
            ))}

        {showEmptyDropHint && (
          <Text
            fontSize="13px"
            color={UI_TOKENS.COLORS.whiteAlpha80}
            textAlign="center"
            lineHeight="1.6"
          >
            カードを戻すとここに整列します
          </Text>
        )}

        {dropZoneEnabled && (
          <>
            <VisuallyHidden>{dropHintLabel}</VisuallyHidden>
            <Box
              pointerEvents="none"
              position="absolute"
              left="50%"
              bottom="-32px"
              transform="translateX(-50%)"
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap="6px"
              opacity={showReturnCue ? 1 : 0}
              transition="opacity 0.2s ease"
            >
              <Box
                fontSize="20px"
                color={UI_TOKENS.COLORS.whiteAlpha90}
                textShadow='0 2px 6px rgba(15, 23, 42, 0.55)'
              >
                ↓
              </Box>
              <Text
                fontSize="12px"
                fontWeight={600}
                color={UI_TOKENS.COLORS.whiteAlpha90}
                textShadow='0 1px 4px rgba(15, 23, 42, 0.6)'
                letterSpacing="0.4px"
              >
                下へスライドで「引く」
              </Text>
            </Box>
          </>
        )}
      </Box>

      <Box as="style">{`@keyframes pulseW{0%{opacity:.85}100%{opacity:1}}`}</Box>
    </VStack>
  );
}
