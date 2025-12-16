/**
 * 統一カードスタイル定数
 * 全てのカードコンポーネントで共通して使用するスタイル定義
 */

import type { SystemStyleObject } from "@chakra-ui/react";
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

  // ドラクエ風ゲームカード用スタイル（GameCard統合用 - HD-2D風）
  // 指示書v2準拠: 月光×焚き火の二重光源、二重枠線、微差運用
  dragonQuest: {
    // 背景: 上から下へ微妙なグラデ（月光→焚き火の光源を暗示）
    // 非対称な3色グラデでAI感を消す
    background: `linear-gradient(
      177deg,
      var(--card-surface-mid) 0%,
      var(--card-surface-base) 38%,
      var(--card-surface-deep) 100%
    )`,
    // 外枠: 金属フレームの気配（暗い真鍮色）
    borderWidth: "var(--card-border-width-outer)",
    borderStyle: "solid" as const,
    borderColor: "var(--card-border-outer)",
    // 角丸: 完全な均一を避けた微差（8px相当だが7pxで手触り感）
    borderRadius: "7px",
    color: UI_TOKENS.COLORS.textBase,
    // 多層シャドウ: 奥行きと光源の両立
    // 1. 環境影（接地感）
    // 2. ドロップシャドウ（浮遊感）
    // 3. 深い影（奥行き）
    // 4. 上部インセット（月光ハイライト）
    // 5. 下部インセット（焚き火の照り返し）
    boxShadow: `
      var(--card-shadow-ambient),
      var(--card-shadow-drop),
      var(--card-shadow-deep),
      var(--card-shadow-inset-top),
      var(--card-shadow-inset-bottom)
    `,
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    aspectRatio: "5/7",
    fontWeight: "bold" as const,
    textShadow: "0 1px 3px rgba(0, 0, 0, 0.7)",
    letterSpacing: "0.3px",
    userSelect: "none" as const,
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden" as const,
    // AI感除去: 0.3s → 0.28s、イージングも微調整
    transition: `background 0.28s ${UI_TOKENS.EASING.standard}, border-color 0.28s ${UI_TOKENS.EASING.standard}, box-shadow 0.28s ${UI_TOKENS.EASING.standard}`,
    // ::before = 内側のハイライト線（二重枠の内側）
    _before: {
      content: '""',
      position: "absolute",
      inset: "2px",
      borderRadius: "5px",
      border: "var(--card-border-width-inner) solid var(--card-border-inner)",
      // 上辺だけ明るく（月光のエッジ）
      borderTopColor: "var(--card-border-highlight)",
      pointerEvents: "none",
      // Watermark用フック: 将来SVG透かしを入れる場合はここに
      backgroundImage: "var(--card-watermark-image)",
      backgroundPosition: "var(--card-watermark-position)",
      backgroundSize: "var(--card-watermark-size)",
      backgroundRepeat: "no-repeat",
    },
    // ::after = 上部の月光グラデ（控えめに）
    _after: {
      content: '""',
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "45%",
      background: `linear-gradient(
        178deg,
        var(--card-light-moon) 0%,
        transparent 70%
      )`,
      borderRadius: "6px 6px 0 0",
      pointerEvents: "none",
    },
    _hover: {
      // ホバー時: わずかな浮き上がり（transformはGSAPに任せるので影のみ）
      boxShadow: `
        var(--card-shadow-ambient),
        0 6px 16px -3px rgba(0, 0, 0, 0.6),
        0 12px 28px -6px rgba(0, 0, 0, 0.5),
        var(--card-shadow-inset-top),
        var(--card-shadow-inset-bottom)
      `,
      borderColor: "var(--card-border-inner)",
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
// 指示書v2準拠: 派手すぎない上品な状態表現、光源との整合性
export const getDragonQuestStyleOverrides = (
  state?: "default" | "success" | "fail" | "ready",
  _waitingInCentral?: boolean
): SystemStyleObject => {
  // 基本背景: CSS変数を使用してグラデーション
  // どちらも同じCSS変数を使用（灰色寄りで連想ワードが映える）
  const baseBg = `linear-gradient(177deg, var(--card-surface-mid) 0%, var(--card-surface-base) 38%, var(--card-surface-deep) 100%)`;

  // 基本枠線色
  // waitingでも“枠が見える”基準フレーム（merihariはstate側で付ける）
  const baseBorderColor = "var(--card-border-outer)";

  // 基本シャドウ（多層構造を維持）
  const baseBoxShadow = `var(--card-shadow-ambient), var(--card-shadow-drop), var(--card-shadow-deep), var(--card-shadow-inset-top), var(--card-shadow-inset-bottom)`;

  // 枠線太さは状態で変えず、色/影でメリハリを出す（文字の折返しが揺れるのを避ける）
  const borderWidth = "1.5px";

  // 状態別のスタイルオーバーライド
  // 派手すぎないように、グローは控えめ、枠線で状態を伝える
  const stateOverrides: Record<"success" | "fail" | "ready" | "default", SystemStyleObject> = {
    success: {
      // 成功: 黄金の枠（焚き火に照らされた金貨のイメージ）
      borderColor: "var(--card-state-success-border)",
      boxShadow: `
        var(--card-shadow-ambient),
        var(--card-shadow-drop),
        var(--card-shadow-deep),
        0 0 12px var(--card-state-success-glow),
        inset 0 1px 0 rgba(212, 175, 55, 0.15),
        inset 0 -1px 0 var(--card-light-fire-edge)
      `,
    },
    fail: {
      // 失敗: 消えかけた炎の赤（焦げた炭のイメージ）
      borderColor: "var(--card-state-fail-border)",
      boxShadow: `
        var(--card-shadow-ambient),
        var(--card-shadow-drop),
        var(--card-shadow-deep),
        0 0 10px var(--card-state-fail-glow),
        inset 0 1px 0 rgba(180, 70, 60, 0.1),
        inset 0 -1px 0 rgba(140, 50, 40, 0.15)
      `,
    },
    ready: {
      // 準備完了: 月光のシルバー（控えめな輝き）
      borderColor: "var(--card-state-ready-border)",
      boxShadow: `
        var(--card-shadow-ambient),
        var(--card-shadow-drop),
        var(--card-shadow-deep),
        0 0 8px var(--card-state-ready-glow),
        inset 0 1px 0 rgba(180, 185, 195, 0.1),
        var(--card-shadow-inset-bottom)
      `,
    },
    default: {
      borderColor: baseBorderColor,
      boxShadow: baseBoxShadow,
    },
  };

  return {
    bg: baseBg,
    borderWidth,
    ...stateOverrides[state ?? "default"],
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
