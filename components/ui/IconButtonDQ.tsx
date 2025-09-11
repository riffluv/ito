"use client";
import { IconButton as CIconButton } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";

export type IconButtonDQProps = React.ComponentProps<typeof CIconButton> & {
  /** border width in px (default 2) */
  borderPx?: number;
};

/**
 * ドラクエ風アイコンボタン（統一スタイル）
 * - 背景: panelBg
 * - 枠: whiteAlpha90（デフォルト 2px）
 * - 角: 0（角ばり）
 * - 影: panelDistinct（hoverでpanelSubtle）
 * - トランジション: 統一EASING
 */
export function IconButtonDQ({ borderPx = 2, css, ...rest }: IconButtonDQProps) {
  return (
    <CIconButton
      bg={UI_TOKENS.COLORS.panelBg}
      color={UI_TOKENS.COLORS.textBase}
      borderRadius={0}
      border={`${borderPx}px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
      boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
      transition={`background-color 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}, color 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}`}
      _hover={{ boxShadow: UI_TOKENS.SHADOWS.panelSubtle }}
      css={css as any}
      {...rest}
    />
  );
}

export default IconButtonDQ;

