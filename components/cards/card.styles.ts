/**
 * 統一カードスタイル定数
 * 全てのカードコンポーネントで共通して使用するスタイル定義
 */

import type { BoxProps } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";

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
  // 空きスロット用スタイル（ドラクエ風完全改造済み）
  empty: {
    bg: "transparent", // 完全透明でHD-2D背景を活かす
    borderWidth: "3px",
    borderColor: "rgba(255, 255, 255, 0.3)", // 古い石板の白枠
    borderStyle: "dashed" as const,
    borderRadius: 0, // 角ばったドラクエ風
    color: "rgba(255, 255, 255, 0.7)", // ドラクエ風白文字
    // シンプルなドラクエ風影のみ
    boxShadow: "none",
    fontSize: "16px", // 少し大きく
    fontWeight: "bold", // ドラクエ風太字
    fontFamily: "monospace", // ドラクエ風フォント統一
    textShadow: "1px 1px 0px #000", // ドラクエ風テキストシャドウ
    letterSpacing: "1px",
    transition: `border-color 0.2s ${UI_TOKENS.EASING.standard}, transform 0.15s ${UI_TOKENS.EASING.standard}`, // シンプルな遷移
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden" as const,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    aspectRatio: "5/7",
    // ホバー効果：古い石が光るドラクエ風
    _hover: {
      borderColor: "rgba(255, 255, 255, 0.6)", // 白枠が少し明るく
      color: "rgba(255, 255, 255, 0.9)",
      boxShadow: "inset 0 0 8px rgba(255, 255, 255, 0.1)", // 内側に薄い光
      transform: "scale(1.02)", // シンプルな拡大
    },
  },
  
  // ゲームカード用ベーススタイル  
  game: {
    bg: "#0f172a",
    borderWidth: "1px",
    borderColor: UI_TOKENS.COLORS.whiteAlpha60,
    borderStyle: "solid" as const,
    borderRadius: "1rem",
    color: UI_TOKENS.COLORS.textBase,
    boxShadow: UI_TOKENS.SHADOWS.cardRaised,
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    aspectRatio: "5/7",
    transition: `background-color 0.3s ${UI_TOKENS.EASING.standard}, border-color 0.3s ${UI_TOKENS.EASING.standard}, box-shadow 0.3s ${UI_TOKENS.EASING.standard}, transform 0.3s ${UI_TOKENS.EASING.standard}`,
    userSelect: "none" as const,
    cursor: "pointer",
    _hover: {
      transform: "translateY(-4px) scale(1.03)",
      boxShadow: UI_TOKENS.SHADOWS.cardHover,
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
    boxShadow: UI_TOKENS.SHADOWS.cardRaised,
    userSelect: "none" as const,
    cursor: "grab",
    transition: `background-color 0.2s ${UI_TOKENS.EASING.standard}, border-color 0.2s ${UI_TOKENS.EASING.standard}, box-shadow 0.2s ${UI_TOKENS.EASING.standard}, transform 0.2s ${UI_TOKENS.EASING.standard}`,
    _active: {
      cursor: "grabbing",
    },
    _hover: {
      transform: "translateY(-2px) scale(1.02)",
      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)",
    },
  },

  // ドラクエ風ゲームカード用スタイル（GameCard統合用）
  dragonQuest: {
    bg: "#0f0f23", // 深い青黒（デフォルト）
    borderWidth: "1px",
    borderStyle: "solid" as const,
    borderColor: UI_TOKENS.COLORS.whiteAlpha60,
    borderRadius: "1rem",
    color: UI_TOKENS.COLORS.textBase,
    boxShadow: UI_TOKENS.SHADOWS.cardRaised,
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    aspectRatio: "5/7",
    fontFamily: "monospace", // ドラクエ風フォント
    fontWeight: "bold" as const,
    textShadow: "1px 1px 2px rgba(0,0,0,0.8)", // ドラクエ風テキストシャドウ
    letterSpacing: "0.5px",
    userSelect: "none" as const,
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden" as const,
    transition: `background-color 0.3s ${UI_TOKENS.EASING.standard}, border-color 0.3s ${UI_TOKENS.EASING.standard}, box-shadow 0.3s ${UI_TOKENS.EASING.standard}, transform 0.3s ${UI_TOKENS.EASING.standard}`,
    _hover: {
      transform: "translateY(-2px) scale(1.02)",
      boxShadow: UI_TOKENS.SHADOWS.cardHover,
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

// ドラクエ風ゲームカードの状態別スタイル生成関数
export const getDragonQuestStyleOverrides = (
  state?: "default" | "success" | "fail" | "ready",
  waitingInCentral?: boolean
) => {
  // 基本色設定
  const baseColors = {
    bg: waitingInCentral ? "#1a1d23" : "#0f0f23",
    border: waitingInCentral ? UI_TOKENS.COLORS.whiteAlpha30 : UI_TOKENS.COLORS.whiteAlpha20,
  };

  // 状態別のスタイルオーバーライド
  const stateOverrides: Record<string, any> = {
    success: {
      borderColor: UI_TOKENS.COLORS.dqGold,
      boxShadow: UI_TOKENS.SHADOWS.cardFloating,
    },
    fail: {
      borderColor: UI_TOKENS.COLORS.dqRed,
      boxShadow: UI_TOKENS.SHADOWS.cardFloating,
    },
    ready: {
      borderColor: UI_TOKENS.COLORS.dqSilver,
      boxShadow: UI_TOKENS.SHADOWS.cardFloating,
    },
    default: {
      borderColor: baseColors.border,
      boxShadow: waitingInCentral
        ? UI_TOKENS.SHADOWS.panelDistinct
        : UI_TOKENS.SHADOWS.cardRaised,
    },
  };

  return {
    bg: baseColors.bg,
    borderWidth: waitingInCentral ? "2px" : "1px",
    ...stateOverrides[state || "default"],
  };
};

// ドラクエ風テキスト色の統一管理
export const getDragonQuestTextColors = (waitingInCentral?: boolean) => ({
  text: UI_TOKENS.COLORS.textBase,
  meta: waitingInCentral ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.textMuted,
  clue: waitingInCentral ? UI_TOKENS.COLORS.textBase : "#e2e8f0",
  number: UI_TOKENS.COLORS.textBase, // 全状態で白色統一
});

export type CardStyleVariant = keyof typeof CARD_STYLES;
export type CardSize = keyof typeof CARD_SIZES;
export type GameCardState = "default" | "success" | "fail" | "ready";
