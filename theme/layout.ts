// 統合レイアウト定数 (Agent Design System Ready)
// agentが正確に計算・予測できる明確な値定義
// Chakra UI v3.25.0 対応 + 2025年DPIスケールベストプラクティス

/**
 * 統一レイアウトシステム
 *
 * 設計原則:
 * 1. 単一責任原則: 1つのファイルで全レイアウト定数を管理
 * 2. 予測可能性: agentが計算しやすい明確な値
 * 3. DPI適応: 125%/150%スケール自動対応
 * 4. スケーラビリティ: トークンベースの拡張可能設計
 */

// === プライマリレイアウト定数 ===
export const UNIFIED_LAYOUT = {
  // ビューポート適応サイズ (DPI最適化)
  HEADER_HEIGHT: "clamp(48px, 4vh, 64px)",
  SIDEBAR_WIDTH: "clamp(240px, 22vw, 300px)",
  RIGHT_PANEL_WIDTH: "clamp(280px, 26vw, 360px)",
  // 手札エリア: トランプ型カード（120px）+ 余裕を持った安定した高さ
  HAND_AREA_HEIGHT: "clamp(180px, 20vh, 220px)",

  // 125% DPI特別対応
  DPI_125: {
    HEADER_HEIGHT: "clamp(44px, 3.5vh, 58px)",
    // 125%DPI環境でもトランプ型カードに十分な高さを確保
    HAND_AREA_HEIGHT: "clamp(160px, 18vh, 200px)",
  },

  // ゲーム要素 (手札エリアと整合性を取る)
  CARD: {
    MIN_WIDTH: "80px", // トランプ型の幅
    // カード高さを手札エリアに収まるように調整
    MIN_HEIGHT: "120px", // トランプ型の高さ（縦長）
  },

  // インタラクション要素
  BUTTON: {
    MIN_HEIGHT: "clamp(36px, 3.5vh, 48px)",
  },

  // ボーダー（統一）
  BORDER_WIDTH: "1px",

  // DPIスケール検出
  MEDIA_QUERIES: {
    DPI_125: "(resolution: 120dpi), (resolution: 1.25dppx)",
    DPI_150: "(resolution: 144dpi), (resolution: 1.5dppx)",
  },
} as const;

// === 後方互換性サポート ===

// DPI_ADAPTIVE_LAYOUT (既存コード用)
export const DPI_ADAPTIVE_LAYOUT = {
  HEADER_HEIGHT_FLUID: UNIFIED_LAYOUT.HEADER_HEIGHT,
  SIDEBAR_WIDTH_FLUID: UNIFIED_LAYOUT.SIDEBAR_WIDTH,
  RIGHT_PANEL_WIDTH_FLUID: UNIFIED_LAYOUT.RIGHT_PANEL_WIDTH,
  HAND_MIN_HEIGHT_FLUID: UNIFIED_LAYOUT.HAND_AREA_HEIGHT,

  // 固定値（廃止予定）
  HEADER_HEIGHT: 60,
  SIDEBAR_WIDTH: 280,
  RIGHT_PANEL_WIDTH: 340,
  HAND_MIN_HEIGHT: 140,
  BOARD_MIN_HEIGHT: 300,

  // DPI スケール検出
  DPI_SCALE_125: UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125,
  DPI_SCALE_150: UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150,

  // 流動的スペーシング（Chakra UIトークンに移行推奨）
  SPACING_FLUID: {
    XS: "clamp(2px, 0.125rem + 0.25vw, 6px)",
    SM: "clamp(4px, 0.25rem + 0.5vw, 12px)",
    MD: "clamp(8px, 0.5rem + 1vw, 20px)",
    LG: "clamp(12px, 0.75rem + 1.5vw, 32px)",
    XL: "clamp(16px, 1rem + 2vw, 48px)",
  },

  // ゲーム要素サイズ
  GAME_ELEMENTS: {
    BUTTON_MIN_HEIGHT: UNIFIED_LAYOUT.BUTTON.MIN_HEIGHT,
    CARD_MIN_WIDTH: UNIFIED_LAYOUT.CARD.MIN_WIDTH,
    CARD_MIN_HEIGHT: UNIFIED_LAYOUT.CARD.MIN_HEIGHT,
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

// レガシー Grid 定数 (削除済み - GameLayoutシステムに移行)
// export const ROOM_GRID_COLUMNS_MD = `${LAYOUT.SIDEBAR_WIDTH}px 1fr ${LAYOUT.RIGHT_PANEL_WIDTH}px`;
// export const ROOM_GRID_ROWS_BASE = `auto 1fr auto`;
// export const ROOM_GRID_ROWS_MD = `auto 1fr minmax(${LAYOUT.HAND_MIN_HEIGHT}px, 160px)`;

export type LayoutConstants = typeof LAYOUT;
export type PredictableLayoutConstants = typeof PREDICTABLE_LAYOUT;
export type DpiAdaptiveLayoutConstants = typeof DPI_ADAPTIVE_LAYOUT;
