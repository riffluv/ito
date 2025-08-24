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
      w={{ base: "88px", md: "96px" }}
      h={{ base: "124px", md: "136px" }}
      rounded="lg"
      display="flex"
      alignItems="center"
      justifyContent="center"
      boxShadow="selfNumber"
      color="#0F3460"
      fontWeight={900}
      fontSize={{ base: "2xl", md: "3xl" }}
      bgGradient="playerNumber"
      userSelect="none"
      aria-label="自分の数字カード"
    >
      {value ?? "?"}
    </Box>
  );
}

export default SelfNumberCard;
