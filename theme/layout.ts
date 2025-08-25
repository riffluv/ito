// 予測可能なレイアウト定数 (Agent Design System Ready)
// agentが正確に計算・予測できる明確な値定義
// Chakra UI v3.25.0 対応 + 2025年DPIスケールベストプラクティス

/**
 * DPI Scale Adaptive Layout Constants
 * 125% DPI スケール対応のための流動的レイアウト定数
 *
 * 設計原則:
 * 1. clamp() による流動的サイズ調整
 * 2. ビューポート単位との組み合わせ
 * 3. 125% DPI での最適化
 * 4. スクロール発生の完全防止
 */
export const DPI_ADAPTIVE_LAYOUT = {
  // ビューポート適応サイズ (125% DPI 最適化)
  HEADER_HEIGHT_FLUID: "clamp(48px, 4vh, 64px)",
  SIDEBAR_WIDTH_FLUID: "clamp(240px, 22vw, 300px)",
  RIGHT_PANEL_WIDTH_FLUID: "clamp(280px, 26vw, 360px)",
  HAND_MIN_HEIGHT_FLUID: "clamp(120px, 15vh, 180px)",

  // 固定値 (後方互換性)
  HEADER_HEIGHT: 60,
  SIDEBAR_WIDTH: 280,
  RIGHT_PANEL_WIDTH: 340,
  HAND_MIN_HEIGHT: 140,
  BOARD_MIN_HEIGHT: 300,

  // DPI スケール検出
  DPI_SCALE_125: "(resolution: 120dpi), (resolution: 1.25dppx)",
  DPI_SCALE_150: "(resolution: 144dpi), (resolution: 1.5dppx)",

  // 流動的スペーシング
  SPACING_FLUID: {
    XS: "clamp(2px, 0.125rem + 0.25vw, 6px)",
    SM: "clamp(4px, 0.25rem + 0.5vw, 12px)",
    MD: "clamp(8px, 0.5rem + 1vw, 20px)",
    LG: "clamp(12px, 0.75rem + 1.5vw, 32px)",
    XL: "clamp(16px, 1rem + 2vw, 48px)",
  },

  // ゲーム要素サイズ (タッチフレンドリー + DPI対応)
  GAME_ELEMENTS: {
    BUTTON_MIN_HEIGHT: "clamp(36px, 3.5vh, 48px)",
    CARD_MIN_WIDTH: "clamp(60px, 8vw, 120px)",
    CARD_MIN_HEIGHT: "clamp(80px, 10vh, 140px)",
  },
} as const;

export const PREDICTABLE_LAYOUT = {
  // 固定サイズ (px)
  HEADER_HEIGHT: 60, // ヘッダー固定高さ
  SIDEBAR_WIDTH: 280, // 左サイドバー幅
  RIGHT_PANEL_WIDTH: 340, // 右パネル幅
  HAND_MIN_HEIGHT: 140, // 手札エリア最小高さ
  BOARD_MIN_HEIGHT: 300, // カードボード最小高さ

  // ボーダー
  BORDER_WIDTH: 1,

  // スペーシング (8px グリッドベース)
  SPACING: {
    XS: 4, // 4px
    SM: 8, // 8px
    MD: 16, // 16px
    LG: 24, // 24px
    XL: 32, // 32px
    XXL: 48, // 48px
  },

  // ブレークポイント
  MOBILE_BREAKPOINT: 768, // md

  // Z-Index レイヤー
  Z_INDEX: {
    BASE: 0,
    PANEL: 10,
    MODAL: 100,
    TOAST: 1000,
  },
} as const;

// ヘルパー関数
export const px = (value: number) => `${value}px`;
export const spacing = (size: keyof typeof PREDICTABLE_LAYOUT.SPACING) =>
  `${PREDICTABLE_LAYOUT.SPACING[size]}px`;

// 後方互換性のため既存の LAYOUT も維持
export const LAYOUT = {
  HEADER_MIN_HEIGHT: PREDICTABLE_LAYOUT.HEADER_HEIGHT,
  SIDEBAR_WIDTH: PREDICTABLE_LAYOUT.SIDEBAR_WIDTH,
  RIGHT_PANEL_WIDTH: PREDICTABLE_LAYOUT.RIGHT_PANEL_WIDTH,
  HAND_MIN_HEIGHT: PREDICTABLE_LAYOUT.HAND_MIN_HEIGHT,
  HAND_TARGET_HEIGHT: 160, // 廃止予定
  BOARD_MIN_HEIGHT: PREDICTABLE_LAYOUT.BOARD_MIN_HEIGHT,
} as const;

// レガシー Grid 定数 (段階的廃止予定)
export const ROOM_GRID_COLUMNS_MD = `${LAYOUT.SIDEBAR_WIDTH}px 1fr ${LAYOUT.RIGHT_PANEL_WIDTH}px`;
export const ROOM_GRID_ROWS_BASE = `auto 1fr auto`;
export const ROOM_GRID_ROWS_MD = `auto 1fr minmax(${LAYOUT.HAND_MIN_HEIGHT}px, 160px)`;

export type LayoutConstants = typeof LAYOUT;
export type PredictableLayoutConstants = typeof PREDICTABLE_LAYOUT;
export type DpiAdaptiveLayoutConstants = typeof DPI_ADAPTIVE_LAYOUT;
