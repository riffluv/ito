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

// 🎯 高度な動的フォントサイズ計算（実際の文字幅とカードサイズを考慮）
const getClueFontSize = (clue: string | undefined): string => {
  if (!clue) return "1.05rem";
  
  // 文字の特性を考慮した重み付け文字数計算
  const calculateEffectiveLength = (text: string): number => {
    let weight = 0;
    for (const char of text) {
      // 日本語文字（ひらがな・カタカナ・漢字）は幅が広い
      if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(char)) {
        weight += 1.4; // 日本語文字は1.4倍の重み
      }
      // 英大文字・数字は標準
      else if (/[A-Z0-9]/.test(char)) {
        weight += 1.0;
      }
      // 英小文字・記号は狭め
      else if (/[a-z\s\-_.,!?()]/.test(char)) {
        weight += 0.8; // 小文字は0.8倍
      }
      // その他（絵文字等）は広め
      else {
        weight += 1.3;
      }
    }
    return weight;
  };
  
  const effectiveLength = calculateEffectiveLength(clue);
  
  // カードの利用可能幅を考慮（padding 0.5rem + border 2px ≈ 16px減算）
  // DPI別のカード幅: 100%=84px, 125%=79px, 150%=72px
  const getOptimalFontSize = (effectiveLength: number): string => {
    // 基準フォントサイズから開始（1文字あたりの幅で逆算）
    const baseFontSize = 20; // px
    const availableWidth = 72; // 最小カード幅（150% DPI）でも収まるよう設計
    const charWidthRatio = 0.6; // フォントサイズに対する平均文字幅の比率
    
    // 最適フォントサイズ = 利用可能幅 / (有効文字数 × 文字幅比率)
    const optimalSize = Math.max(
      Math.min(baseFontSize, availableWidth / (effectiveLength * charWidthRatio)),
      10 // 最小サイズ10px
    );
    
    // レスポンシブ調整: DPI 150%でも読みやすいよう基準値を調整
    return `${Math.round(optimalSize * 0.8)}px`; // 0.8倍で余裕を持たせる
  };
  
  // 段階的調整（可読性が急激に落ちないよう緩やかに縮小）
  if (effectiveLength <= 4) return "1.05rem";
  if (effectiveLength <= 7) return "0.95rem";
  if (effectiveLength <= 11) return "0.86rem";
  if (effectiveLength <= 16) return "0.78rem";
  if (effectiveLength <= 22) return "0.7rem";
  if (effectiveLength <= 28) return "0.66rem";

  // 超長文の場合は計算ベースの最適化（ただし極端に小さくしない）
  const optimizedPx = getOptimalFontSize(effectiveLength);
  const optimized = parseFloat(optimizedPx) / 16; // px → rem 換算
  const clamped = Math.max(0.6, Math.min(0.66, optimized));
  return `${clamped}rem`;
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