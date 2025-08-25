"use client";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";

export interface SelfNumberCardProps {
  value: number | null | undefined;
  draggableId?: string;
  onDragStart?: (e: React.DragEvent) => void;
}

/**
 * 自分の数字カード表示 (手札領域)
 * デザインは theme.tokens.gradients.playerNumber / shadows.selfNumber を利用。
 * 統一レイアウトシステムによるDPI対応。
 */
export function SelfNumberCard({
  value,
  draggableId,
  onDragStart,
}: SelfNumberCardProps) {
  return (
    <Box
      as="div"
      draggable
      onDragStart={(e: React.DragEvent) => {
        if (draggableId) {
          try {
            e.dataTransfer.setData("text/plain", draggableId);
          } catch {}
        }
        onDragStart?.(e);
      }}
      w={UNIFIED_LAYOUT.CARD.MIN_WIDTH}
      h={UNIFIED_LAYOUT.CARD.MIN_HEIGHT}
      rounded="lg"
      display="flex"
      alignItems="center"
      justifyContent="center"
      boxShadow="selfNumber"
      color="selfNumberFg"
      fontWeight={900}
      fontSize={{ base: "2xl", md: "3xl" }}
      bgGradient="playerNumber"
      userSelect="none"
      aria-label="自分の数字カード"
      tabIndex={0}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "focusRing",
        outlineOffset: 2,
      }}
    >
      {value ?? "?"}
    </Box>
  );
}

export default SelfNumberCard;
