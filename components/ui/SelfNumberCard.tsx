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
      // Professional My Card - Responsive Design (UNIFIED_LAYOUT に揃える)
      width={UNIFIED_LAYOUT.CARD.WIDTH}
      height={UNIFIED_LAYOUT.CARD.HEIGHT}
      bg="#0f172a" // --slate-900
      color="white"
      borderRadius="1rem" // --radius-xl
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      boxShadow="0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" // --shadow-lg
      userSelect="none"
      aria-label="自分の数字カード"
      tabIndex={0}
      cursor="grab"
      _active={{
        cursor: "grabbing",
      }}
      _hover={{
        transform: "translateY(-2px) scale(1.02)",
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)",
      }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "focusRing",
        outlineOffset: 2,
      }}
      transition="all 0.2s ease"
    >
      <Box
        fontSize={{ base: "0.65rem", md: "0.75rem" }}
        opacity={0.8}
        marginBottom="0.5rem"
        textTransform="uppercase"
        letterSpacing="0.05em"
      >
        あなたの数字
      </Box>
      <Box
        fontSize={{ base: "2.5rem", md: "3rem" }}
        fontWeight={700}
        lineHeight={1}
      >
        {value ?? "?"}
      </Box>
    </Box>
  );
}

export default SelfNumberCard;
