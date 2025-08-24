"use client";
import { Box } from "@chakra-ui/react";

export interface SelfNumberCardProps {
  value: number | null | undefined;
  draggableId?: string;
  onDragStart?: (e: React.DragEvent) => void;
}

/**
 * 自分の数字カード表示 (手札領域)
 * デザインは theme.tokens.gradients.playerNumber / shadows.selfNumber を利用。
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
      w="100px"
      h="140px"
      rounded="12px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      boxShadow="selfNumber"
      color="#0F3460"
      fontWeight={900}
      fontSize="28px"
      bgGradient="playerNumber"
      userSelect="none"
      aria-label="自分の数字カード"
    >
      {value ?? "?"}
    </Box>
  );
}

export default SelfNumberCard;
