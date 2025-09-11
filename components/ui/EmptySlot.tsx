import { Box } from "@chakra-ui/react";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";

/**
 * 空のカードスロットコンポーネント
 * sort-submitモードで使用する配置予定スロット
 */
interface EmptySlotProps {
  index: number; // 1-based表示用のインデックス
}

export function EmptySlot({ index }: EmptySlotProps) {
  return (
    <Box
      data-slot
      css={{
        aspectRatio: "5 / 7",
        width: UNIFIED_LAYOUT.CARD.WIDTH,
        placeSelf: "start",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: UI_TOKENS.COLORS.whiteAlpha02,
        border: `1.5px dashed ${UI_TOKENS.COLORS.whiteAlpha15}`,
        borderRadius: "16px",
        boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
        backdropFilter: "blur(4px)",
        fontSize: "1.125rem",
        fontWeight: 500,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
        color: UI_TOKENS.COLORS.whiteAlpha40,
        letterSpacing: "-0.01em",
        transition: `background-color 0.3s ${UI_TOKENS.EASING.standard}, border-color 0.3s ${UI_TOKENS.EASING.standard}, box-shadow 0.3s ${UI_TOKENS.EASING.standard}, transform 0.2s ${UI_TOKENS.EASING.standard}`,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        
        "&:hover": {
          background: UI_TOKENS.COLORS.whiteAlpha10,
          borderColor: UI_TOKENS.COLORS.whiteAlpha30,
          color: UI_TOKENS.COLORS.textMuted,
          transform: "translateY(-2px)",
          boxShadow: UI_TOKENS.SHADOWS.cardHover,
        },
      }}
    >
      {index}
    </Box>
  );
}

export default EmptySlot;
