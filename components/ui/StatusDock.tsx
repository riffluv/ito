"use client";
import { Box, BoxProps } from "@chakra-ui/react";

export interface StatusDockProps extends Omit<BoxProps, "children"> {
  children?: React.ReactNode;
  /** true のときだけ最小高さを確保 */
  show?: boolean;
}

/**
 * ボード直下に置くステータス帯。
 * 幅・左右余白・中央線をカードボードと完全一致させる。
 */
export default function StatusDock({
  children,
  show = false,
  ...rest
}: StatusDockProps) {
  return (
    <Box
      data-status-dock
      paddingBlock={{ base: 1, md: 2 }}
      mt={{ base: 2, md: 2 }}
      // 背景色が artifact に見えている可能性があるため透過化し、内部で色を付けるオプション
      bg={show ? "transparent" : "transparent"}
      {...rest}
    >
      <Box
        data-status-dock-inner
        width="100%"
        maxWidth="var(--board-max-width)"
        marginInline="auto"
        paddingInline={{ base: 2, md: 3 }}
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontSize={{ base: "0.625rem", md: "0.75rem" }}
        color="fgMuted"
        css={{ containerType: "inline-size" }}
        minH={show ? { base: 7, md: 8 } : 0}
        // finished 時に完全透明
        bg={show ? "transparent" : "transparent"}
      >
        {children}
      </Box>
    </Box>
  );
}
