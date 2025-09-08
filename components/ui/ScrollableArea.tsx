"use client";
import { Box, BoxProps } from "@chakra-ui/react";
import { ReactNode } from "react";

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

export function ScrollableArea({
  children,
  label,
  withPadding = true,
  padding = 4,
  ...boxProps
}: ScrollableAreaProps) {
  return (
    <Box
      h="100%"
      minH={0}
      overflowY="auto"
      overflowX="hidden"
      aria-label={label}
      // スムーズなスクロール
      css={{
        scrollBehavior: "smooth",
        // WebKitスクロールバーのスタイリング
        "&::-webkit-scrollbar": {
          width: "8px",
        },
        "&::-webkit-scrollbar-track": {
          background: "var(--chakra-colors-panelSubBg)",
        },
        "&::-webkit-scrollbar-thumb": {
          background: "var(--chakra-colors-borderDefault)",
          borderRadius: "4px",
        },
        "&::-webkit-scrollbar-thumb:hover": {
          background: "var(--chakra-colors-fgMuted)",
        },
      }}
      {...boxProps}
    >
      <Box p={withPadding ? padding : 0}>{children}</Box>
    </Box>
  );
}

export default ScrollableArea;
