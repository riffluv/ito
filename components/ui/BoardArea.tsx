"use client";
import { UNIFIED_LAYOUT, getDynamicBorder } from "@/theme/layout";
import { Box, BoxProps } from "@chakra-ui/react";

export type BoardAreaProps = BoxProps & {
  isOver?: boolean;
  droppable?: boolean;
};

export default function BoardArea({ isOver, droppable = true, children, ...rest }: BoardAreaProps) {
  return (
    <Box position="relative" minH={UNIFIED_LAYOUT.BOARD_MIN_HEIGHT} display="flex" flexDir="column">
      <Box
        role="region"
        aria-label="カード配置エリア"
        aria-disabled={!droppable}
        position="relative"
        minH={UNIFIED_LAYOUT.BOARD_MIN_HEIGHT} /* 8人分のカード配置に十分な統一高さ */
        p={4} /* カードの上下左右スペーシング */
        borderStyle="dashed"
        borderColor={isOver ? "accent" : droppable ? "borderDefault" : "transparent"}
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
        bg={isOver ? "accentSubtle" : "panelSubBg"}
        backgroundImage="var(--gradients-boardPattern)"
        cursor={droppable ? (isOver ? "copy" : "default") : "not-allowed"}
        transition="all 150ms ease"
        {...rest}
      >
        {/* ドラッグ中の視覚ヒント */}
        {isOver && (
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            px={3}
            py={1}
            rounded="full"
            bg="panelBg"
            borderColor="accent"
            borderWidth="1px"
            color="accent"
            fontSize="sm"
            fontWeight="semibold"
            pointerEvents="none"
          >
            ここに置く
          </Box>
        )}
        {children}
      </Box>
    </Box>
  );
}
