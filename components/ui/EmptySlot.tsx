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
        // 完全透明ベース
        background: "transparent",
        // ドラクエ風古い石板の破線枠
        border: "3px dashed rgba(255, 255, 255, 0.3)",
        borderRadius: 0, // 角ばったドラクエ風
        // ドラクエ風フォント
        fontSize: "1.5rem",
        fontWeight: "bold",
        fontFamily: "monospace",
        color: "rgba(255, 255, 255, 0.6)",
        textShadow: "1px 1px 0px #000",
        letterSpacing: "1px",
        cursor: "pointer",
        position: "relative",
        // ドラクエ風遷移
        transition: `border-color 0.2s ${UI_TOKENS.EASING.standard}, color 0.2s ${UI_TOKENS.EASING.standard}, transform 0.15s ${UI_TOKENS.EASING.standard}`,

        "&:hover": {
          // ホバー時は古い石の光る感じに
          borderColor: "rgba(255, 255, 255, 0.7)",
          color: "rgba(255, 255, 255, 0.9)",
          transform: "scale(1.02)",
          // 内側に薄い光を追加
          boxShadow: "inset 0 0 8px rgba(255, 255, 255, 0.1)",
        },

        // 古い遺跡っぽい装飾を追加
        "&::before": {
          content: '""',
          position: "absolute",
          top: "8px",
          left: "8px",
          right: "8px",
          bottom: "8px",
          border: "1px dotted rgba(255, 255, 255, 0.2)",
          borderRadius: 0,
        },
      }}
    >
      {/* ドラクエ風番号表示 */}
      {index}
    </Box>
  );
}

export default EmptySlot;
