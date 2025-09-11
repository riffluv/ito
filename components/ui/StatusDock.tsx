"use client";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
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
      padding={UNIFIED_LAYOUT.SPACING.COMPONENT_PADDING}
      mt={UNIFIED_LAYOUT.SPACING.COMPONENT_PADDING}
      // メインメニューと同じドラクエ風ボーダー
      border={show ? "borders.retrogame" : "none"}
      borderColor={UI_TOKENS.COLORS.whiteAlpha90}
      borderRadius="lg"
      bg={show ? "transparent" : "transparent"}
      css={show ? {
        // 情報密度重視のクリーンな背景
        background: UI_TOKENS.COLORS.panelBg,
        // テクスチャなしでクリーンに
        backdropFilter: "blur(4px)",
        // 控えめな影で浮き上がり感のみ
        boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
      } : {}}
      {...rest}
    >
      <Box
        data-status-dock-inner
        width="100%"
        maxWidth="var(--board-max-width)"
        marginInline="auto"
        paddingInline={UNIFIED_LAYOUT.SPACING.COMPONENT_PADDING}
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
