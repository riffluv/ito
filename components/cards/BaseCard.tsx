/**
 * 統一ベースカードコンポーネント
 * 全てのカードの共通基盤となるコンポーネント
 */

import { Box } from "@chakra-ui/react";
import { forwardRef } from "react";
import { CARD_STYLES, CARD_SIZES } from "./card.styles";
import type { BaseCardProps } from "./card.types";

export const BaseCard = forwardRef<HTMLDivElement, BaseCardProps>(
  ({ variant = "empty", size = "md", children, ...props }, ref) => {
    const variantStyles = CARD_STYLES[variant];
    const sizeConfig = CARD_SIZES[size];

    return (
      <Box
        ref={ref}
        width={sizeConfig.width}
        height={sizeConfig.height}
        minWidth={sizeConfig.width}
        minHeight={sizeConfig.height}
        {...variantStyles}
        {...props}
        css={{
          // レスポンシブサイズ対応
          width: size === "md" ? "100px" : sizeConfig.width,
          minWidth: size === "md" ? "100px" : sizeConfig.width,
          "@media (min-width: 768px)": {
            width: size === "md" ? "120px" : sizeConfig.width,
            minWidth: size === "md" ? "120px" : sizeConfig.width,
            height: size === "md" ? "168px" : sizeConfig.height,
            minHeight: size === "md" ? "168px" : sizeConfig.height,
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