/**
 * 統一ベースカードコンポーネント
 * 全てのカードの共通基盤となるコンポーネント
 */

import { Box } from "@chakra-ui/react";
import { forwardRef } from "react";
import { CARD_SIZES, CARD_STYLES } from "./card.styles";
import type { BaseCardProps } from "./card.types";

export const BaseCard = forwardRef<HTMLDivElement, BaseCardProps>(
  ({ variant = "empty", size = "md", children, ...props }, ref) => {
    const variantStyles = CARD_STYLES[variant];
    const sizeConfig = CARD_SIZES[size];

    return (
      <Box
        ref={ref}
        // ✅ レスポンシブサイズ適用 (!important除去)
        width={{ 
          base: sizeConfig.width.base, 
          md: sizeConfig.width.md 
        }}
        height={{ 
          base: sizeConfig.height.base, 
          md: sizeConfig.height.md 
        }}
        minWidth={{ 
          base: sizeConfig.width.base, 
          md: sizeConfig.width.md 
        }}
        minHeight={{ 
          base: sizeConfig.height.base, 
          md: sizeConfig.height.md 
        }}
        {...variantStyles}
        {...props}
        css={{
          // DPI125%対応：GameCardと統一
          "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)": {
            width: sizeConfig.width.dpi125,
            minWidth: sizeConfig.width.dpi125,
            height: sizeConfig.height.dpi125,
            minHeight: sizeConfig.height.dpi125,
          },
          "@media (min-resolution: 1.25dppx) and (min-width: 768px), screen and (-webkit-device-pixel-ratio: 1.25) and (min-width: 768px)": {
            width: sizeConfig.width.dpi125md,
            minWidth: sizeConfig.width.dpi125md,
            height: sizeConfig.height.dpi125md,
            minHeight: sizeConfig.height.dpi125md,
          },
          // DPI 150%対応をCSS変数で管理
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
            width: sizeConfig.width.dpi150,
            minWidth: sizeConfig.width.dpi150,
            height: sizeConfig.height.dpi150,
            minHeight: sizeConfig.height.dpi150,
          },
          "@media (min-resolution: 1.5dppx) and (min-width: 768px), screen and (-webkit-device-pixel-ratio: 1.5) and (min-width: 768px)": {
            width: sizeConfig.width.dpi150md,
            minWidth: sizeConfig.width.dpi150md,
            height: sizeConfig.height.dpi150md,
            minHeight: sizeConfig.height.dpi150md,
          },
          // フォント描画改善: レイヤー促進
          transform: "translateZ(0)",
          willChange: "auto",
          ...((props.css || {}) as any),
        }}
      >
        {children}
      </Box>
    );
  }
);

BaseCard.displayName = "BaseCard";

export default BaseCard;
