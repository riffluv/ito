"use client";
import { Box, BoxProps } from "@chakra-ui/react";
import { ReactNode, forwardRef } from "react";

/**
 * ScrollableArea: 明確な境界を持つスクロール領域
 *
 * 特徴:
 * - 予測可能なスクロール動作
 * - 明確なサイズ制約
 * - デバッグしやすい構造
 * - 一貫したパディング制御
 */
export interface ScrollableAreaProps extends Omit<BoxProps, "children"> {
  children: ReactNode;
  /** アクセシビリティラベル */
  label?: string;
  /** パディングを適用するか */
  withPadding?: boolean;
  /** パディングサイズ */
  padding?: number | string;
}

export const ScrollableArea = forwardRef<HTMLDivElement, ScrollableAreaProps>(
  ({ children, label, withPadding = true, padding = 4, ...boxProps }, ref) => {
    return (
      <Box
        ref={ref}
        h="100%"
        minH={0}
        overflowY="auto"
        overflowX="hidden"
        aria-label={label}
        // スムーズなスクロール
        css={{
          scrollBehavior: "smooth",
          // Octopath Traveler-style: minimal, elegant scrollbar
          "&::-webkit-scrollbar": {
            width: "4px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(255,255,255,0.2)",
            borderRadius: "2px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "rgba(255,255,255,0.35)",
          },
        }}
        {...boxProps}
      >
        <Box p={withPadding ? padding : 0}>{children}</Box>
      </Box>
    );
  }
);

ScrollableArea.displayName = "ScrollableArea";

export default ScrollableArea;
