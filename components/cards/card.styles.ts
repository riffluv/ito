/**
 * 統一カードスタイル定数
 * 全てのカードコンポーネントで共通して使用するスタイル定義
 */

import type { BoxProps } from "@chakra-ui/react";

// ✅ レスポンシブカードサイズ定義 (!important除去)
export const CARD_SIZES = {
  sm: {
    width: { base: "70px", md: "80px", dpi125: "67px", dpi125md: "76px", dpi150: "62px", dpi150md: "70px" },
    height: { base: "98px", md: "112px", dpi125: "93px", dpi125md: "106px", dpi150: "86px", dpi150md: "98px" },
    fontSize: "sm",
  },
  md: {
    width: { base: "100px", md: "120px", dpi125: "95px", dpi125md: "114px", dpi150: "88px", dpi150md: "105px" },
    height: { base: "140px", md: "168px", dpi125: "133px", dpi125md: "160px", dpi150: "123px", dpi150md: "147px" },
    fontSize: "md",
  },
  lg: {
    width: { base: "120px", md: "140px", dpi125: "114px", dpi125md: "133px", dpi150: "105px", dpi150md: "123px" },
    height: { base: "168px", md: "196px", dpi125: "160px", dpi125md: "186px", dpi150: "147px", dpi150md: "172px" },
    fontSize: "lg",
  }
} as const;

// 統一カードスタイル定義
export const CARD_STYLES = {
  // 空きスロット用スタイル（統一済み）
  empty: {
    bg: "#191B21",
    borderWidth: "1.5px",
    borderColor: "rgba(20, 184, 166, 0.4)",
    borderStyle: "dashed" as const,
    borderRadius: "16px",
    color: "rgba(255,255,255,0.80)",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.1)",
    backdropFilter: "blur(4px)",
    fontSize: "lg",
    fontWeight: "600",
    letterSpacing: "-0.01em",
    transition: "all 0.2s ease",
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden" as const,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    aspectRatio: "5/7",
    // ホバー効果
    _hover: {
      bg: "rgba(99,102,241,0.1)",
      borderColor: "rgba(99,102,241,0.4)",
      color: "rgba(255,255,255,0.8)",
      boxShadow: "inset 0 1px 3px rgba(99,102,241,0.1), 0 2px 6px rgba(99,102,241,0.2)",
      transform: "translateY(-1px)",
    },
  },
  
  // ゲームカード用ベーススタイル  
  game: {
    bg: "#0f172a",
    borderWidth: "1px",
    borderColor: "rgba(255,255,255,0.6)",
    borderStyle: "solid" as const,
    borderRadius: "1rem",
    color: "#ffffff",
    boxShadow: "0 4px 16px -4px rgba(0,0,0,0.25), 0 2px 8px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    aspectRatio: "5/7",
    transition: "all 0.3s ease",
    userSelect: "none" as const,
    cursor: "pointer",
    _hover: {
      transform: "translateY(-4px) scale(1.03)",
      boxShadow: "0 20px 25px -5px rgba(0,0,0,0.4), 0 10px 10px -5px rgba(0,0,0,0.25)",
    },
  },

  // 数字表示カード用スタイル
  number: {
    bg: "#0f172a",
    color: "white",
    borderRadius: "1rem",
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    userSelect: "none" as const,
    cursor: "grab",
    transition: "all 0.2s ease",
    _active: {
      cursor: "grabbing",
    },
    _hover: {
      transform: "translateY(-2px) scale(1.02)",
      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)",
    },
  },
} as const;

// 数字サイズ計算関数（既存ロジックを統合）
export const getNumberFontSize = (number: number | null | undefined): { base: string; md: string } => {
  if (typeof number !== "number") return { base: "2rem", md: "2.5rem" };
  
  const digits = String(number).length;
  if (digits <= 1) return { base: "2rem", md: "2.5rem" };
  if (digits === 2) return { base: "1.8rem", md: "2.2rem" };
  if (digits === 3) return { base: "1.4rem", md: "1.8rem" };
  return { base: "1.2rem", md: "1.6rem" };
};

// 文字間隔計算関数
export const getLetterSpacing = (number: number | null | undefined): string => {
  if (typeof number !== "number") return "normal";
  const digits = String(number).length;
  return digits >= 3 ? "-0.1em" : "normal";
};

export type CardStyleVariant = keyof typeof CARD_STYLES;
export type CardSize = keyof typeof CARD_SIZES;