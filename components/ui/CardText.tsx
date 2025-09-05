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
  if (length <= 4) return "1.22rem";
  if (length <= 6) return "1.1rem";
  if (length <= 8) return "1rem";
  if (length <= 10) return "0.9rem";
  return "0.8rem";
};

const getNumberFontSize = (number: number | null): string => {
  if (typeof number !== "number") return "1.22rem";

  const digits = String(number).length;
  if (digits <= 1) return "3rem";
  if (digits === 2) return "2.8rem";
  if (digits === 3) return "2.1rem"; // 3桁数字のフォントサイズを縮小
  return "1.9rem"; // 4桁以上はさらに縮小
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
    lineHeight: isNumber ? 1.05 : 1.1,
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
    letterSpacing: isNumber && String(text).length >= 3 ? "-1.5px" : undefined, // 3桁数字の文字詰めを強化
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