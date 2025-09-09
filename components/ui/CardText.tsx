// GameCard用の統一テキスト表示コンポーネント
import { Box } from "@chakra-ui/react";

interface CardTextProps {
  text?: string | number;
  textType: "clue" | "number";
  fontSize: string;
  color: string;
  textShadow?: string;
  waitingInCentral?: boolean;
}

// 🎯 動的フォントサイズ計算関数（GameCardから移動）
const getClueFontSize = (clue: string | undefined): string => {
  if (!clue) return "1.22rem";
  
  const length = clue.length;
  if (length <= 3) return "1.25rem";   // 3文字以下: 大きめ
  if (length <= 5) return "1.1rem";    // 4-5文字: 中程度
  if (length <= 7) return "0.95rem";   // 6-7文字: やや小さめ
  if (length <= 9) return "0.85rem";   // 8-9文字: 小さめ
  if (length <= 12) return "0.75rem";  // 10-12文字: かなり小さめ
  if (length <= 15) return "0.68rem";  // 13-15文字: とても小さめ
  return "0.62rem";                    // 16文字以上: 最小
};

const getNumberFontSize = (number: number | null): string => {
  if (typeof number !== "number") return "1.22rem";

  const digits = String(number).length;
  if (digits <= 1) return "3rem";
  if (digits === 2) return "2.8rem";
  if (digits === 3) return "2.5rem"; // 3桁数字を最適サイズに調整（100対応）
  return "1.8rem"; // 4桁以上も読みやすく調整
};

export function CardText({
  text,
  textType,
  fontSize,
  color,
  textShadow,
  waitingInCentral = false,
}: CardTextProps) {
  const isNumber = textType === "number" && typeof text === "number";
  const isClue = textType === "clue" && typeof text === "string";

  // 🎯 完全統一されたテキストスタイル
  const unifiedTextStyle = {
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontWeight: 700,
    fontSize: isNumber ? getNumberFontSize(text as number) : getClueFontSize(text as string),
    color,
    lineHeight: isNumber ? 1.2 : 1.3, // ディセンダー対応
    textShadow: waitingInCentral ? "none" : textShadow,
    width: "100%",
    maxWidth: "calc(100% - 8px)",
    textAlign: "center" as const,
    padding: "0 0.25rem",
    wordBreak: isNumber ? ("keep-all" as const) : ("break-word" as const),
    whiteSpace: isNumber ? ("nowrap" as const) : ("normal" as const),
    overflowWrap: isNumber ? ("normal" as const) : ("anywhere" as const),
    overflow: "hidden",
    display: isNumber ? "block" : "flex",
    alignItems: isNumber ? undefined : "center",
    justifyContent: isNumber ? undefined : "center",
    letterSpacing: isNumber && String(text).length >= 3 ? "-0.8px" : undefined, // 3桁数字の適切な文字間隔（100の視認性向上）
    // フォント描画統一
    WebkitFontSmoothing: "antialiased" as const,
    MozOsxFontSmoothing: "grayscale" as const,
    // テキスト処理統一
    wordWrap: isNumber ? ("normal" as const) : ("break-word" as const),
    hyphens: isNumber ? ("none" as const) : ("auto" as const),
  };

  return (
    <Box position="relative">
      <Box style={unifiedTextStyle}>
        {isNumber ? text : isClue ? text : "?"}
      </Box>
    </Box>
  );
}

export { getClueFontSize, getNumberFontSize };