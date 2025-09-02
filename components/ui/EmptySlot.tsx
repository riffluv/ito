import { Box } from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";

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
        background: "rgba(255,255,255,0.02)",
        border: "1.5px dashed rgba(255,255,255,0.15)",
        borderRadius: "16px",
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.03)",
        backdropFilter: "blur(4px)",
        fontSize: "1.125rem",
        fontWeight: 500,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
        color: "rgba(255,255,255,0.4)",
        letterSpacing: "-0.01em",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        
        "&:hover": {
          background: "rgba(255,255,255,0.06)",
          borderColor: "rgba(255,255,255,0.25)",
          color: "rgba(255,255,255,0.7)",
          transform: "translateY(-2px)",
          boxShadow:
            "0 4px 12px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.06)",
        },
      }}
    >
      {index}
    </Box>
  );
}

export default EmptySlot;