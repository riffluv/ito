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
        background: "linear-gradient(135deg, rgba(139, 69, 197, 0.08), rgba(67, 56, 202, 0.05))",
        border: `2px dashed rgba(167, 139, 250, 0.4)`,
        boxShadow: `
          inset 0 0 12px rgba(139, 69, 197, 0.15),
          0 0 8px rgba(167, 139, 250, 0.2),
          ${UI_TOKENS.SHADOWS.panelSubtle}
        `,
        borderRadius: "16px",
        backdropFilter: "blur(4px)",
        fontSize: "1.125rem",
        fontWeight: 500,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
        color: "rgba(196, 181, 253, 0.7)",
        letterSpacing: "-0.01em",
        transition: `background-color 0.3s ${UI_TOKENS.EASING.standard}, border-color 0.3s ${UI_TOKENS.EASING.standard}, box-shadow 0.3s ${UI_TOKENS.EASING.standard}, transform 0.2s ${UI_TOKENS.EASING.standard}`,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        
        "&:hover": {
          background: "linear-gradient(135deg, rgba(139, 69, 197, 0.15), rgba(67, 56, 202, 0.12))",
          borderColor: "rgba(167, 139, 250, 0.7)",
          color: "rgba(196, 181, 253, 0.9)",
          transform: "translateY(-2px)",
          boxShadow: `
            inset 0 0 20px rgba(139, 69, 197, 0.25),
            0 0 16px rgba(167, 139, 250, 0.4),
            0 4px 20px rgba(0, 0, 0, 0.3)
          `,
        },
      }}
    >
      {index}
    </Box>
  );
}

export default EmptySlot;
