"use client";
import { UNIFIED_LAYOUT, getDynamicBorder } from "@/theme/layout";
import { Box, BoxProps } from "@chakra-ui/react";

export type BoardAreaProps = BoxProps & {
  isOver?: boolean;
};

export default function BoardArea({
  isOver,
  children,
  ...rest
}: BoardAreaProps) {
  return (
    <Box
      position="relative"
      h={UNIFIED_LAYOUT.BOARD_MIN_HEIGHT}
      display="flex"
      flexDir="column"
    >
      <Box
        role="region"
        aria-label="カード配置エリア"
        position="relative"
        h={
          UNIFIED_LAYOUT.BOARD_MIN_HEIGHT
        } /* 8人分のカード配置に十分な統一高さ */
        p={4} /* カードの上下左右スペーシング */
        borderStyle="dashed"
        borderColor={isOver ? "accent" : "transparent"}
        borderWidth={getDynamicBorder({
          isActive: !!isOver,
          activeContext: "SEMANTIC",
          defaultContext: "LAYOUT",
        })}
        rounded="lg"
        display="flex"
        gap={4} /* 統一されたカード間スペーシング */
        alignItems="center"
        flexWrap="wrap"
        justifyContent="center" // 単数枚時も中央に配置
        perspective="1000px" // 3Dカードアニメーション用
        css={{
          "& .gamecard-inner": {
            transformStyle: "preserve-3d",
          },
        }}
        bg={
          isOver
            ? "rgba(78,205,196,0.04)"
            : "repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 8px, transparent 8px, transparent 16px)"
        }
        transition="all 150ms ease"
        {...rest}
      >
        {children}
      </Box>
    </Box>
  );
}
