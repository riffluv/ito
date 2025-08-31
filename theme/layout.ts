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
  HEADER_HEIGHT: "clamp(80px, 8dvh, 120px)",
  SIDEBAR_WIDTH: "clamp(240px, 22vw, 300px)",
  RIGHT_PANEL_WIDTH: "clamp(280px, 26vw, 360px)",
  // 手札エリア: トランプ型カード（120px）+ ゆとりを持った安定した高さ（ゲーム感重視）
  HAND_AREA_HEIGHT: "clamp(220px, 25dvh, 280px)",

  // 125% DPI特別対応
  DPI_125: {
    HEADER_HEIGHT: "clamp(64px, 6dvh, 96px)",
    // 125%DPI環境でもトランプ型カードに十分な高さを確保（ゲーム感重視）
    HAND_AREA_HEIGHT: "clamp(180px, 18dvh, 220px)",
  },

  // 150% DPI特別対応（小型ノートPCでの高さ確保を優先）
  DPI_150: {
    HEADER_HEIGHT: "clamp(56px, 5.5dvh, 88px)",
    HAND_AREA_HEIGHT: "clamp(160px, 16dvh, 200px)",
  },

  // ゲーム要素 (手札エリアと整合性を取る）- ゲーム感強化
  CARD: {
    // 手札とボードで統一するカードサイズ（トランプ比 5:7 付近）
    WIDTH: { base: "100px", md: "120px" },
    HEIGHT: { base: "140px", md: "168px" },
    // 後方互換用の最小値（内部レイアウトが min-* 参照する可能性に備える）
    MIN_WIDTH: "100px",
    MIN_HEIGHT: "140px",
  },

  // インタラクション要素
  BUTTON: {
    MIN_HEIGHT: "clamp(36px, 3.5vh, 48px)",
  },

  // 🔄 BORDER MANAGEMENT SYSTEM - コンテキストアウェア設計
  // 競合リスクを回避し、将来の拡張性を保証
  BORDER: {
    WIDTH: {
      NONE: "0px", // 完全borderless
      THIN: "1px", // 標準的なborder
      MEDIUM: "2px", // 強調用border
      THICK: "3px", // 装飾用border
    },
  },

  // ボード要素（DPI適応）- コンパクト化で手札エリアを強化
  BOARD_MIN_HEIGHT: "clamp(180px, 18dvh, 240px)",

  // モニター要素（コンパクト化対応）
  MONITOR_MIN_HEIGHT: "clamp(140px, 14dvh, 180px)", // 180px固定値の代替

  // コンポーネント間スペーシング（統一制御）
  SPACING: {
    COMPONENT_PADDING: "16px", // 統一パディング（Chakraの4に相当）
    SECTION_GAP: "0px", // セクション間のギャップ（外側制御のため0）
    INNER_SPACING: "24px", // 内部要素の間隔（Chakraの6に相当）
    CARD_GAP: "12px", // カード間のギャップ（Chakraの3に相当）
    FORM_GAP: "8px", // フォーム要素間のギャップ（Chakraの2に相当）
  },

  // Z-Index管理（統一）
  Z_INDEX: {
    BASE: 0,
    CONTENT: 1,
    PANEL: 10,
    HEADER: 100,
    MODAL: 1000,
    TOAST: 2000,
  },

  // 🎮 ELEVATION SYSTEM - モダンゲームUI 2025
  // borderの代替手法: shadow + background + spacing
  ELEVATION: {
    // カード階層
    CARD: {
      FLAT: "none", // borderlessカード
      RAISED: "var(--shadows-cardRaised)", // 軽い浮遊感
      FLOATING: "var(--shadows-cardFloating)", // ホバー時
      ELEVATED: "var(--shadows-cardElevated)", // モーダル要素
    },
    // パネル階層
    PANEL: {
      BASE: "none", // 基本パネルはborderless
      SUBTLE: "var(--shadows-panelSubtle)", // 微細なshadow
      DISTINCT: "var(--shadows-panelDistinct)", // 明確な分離
    },
    // ゲーム要素
    GAME: {
      HAND_CARD: "var(--shadows-cardFloating)", // 手札カード
      BOARD_CARD: "var(--shadows-cardRaised)", // 場のカード
      ACTIVE_AREA: "var(--shadows-activeArea)", // アクティブエリア（内側shadow）
    },
  },

  // 🎨 SURFACE SYSTEM - 背景による領域区別
  SURFACE: {
    // 基本階層
    BASE: "bg.canvas", // アプリ背景
    PANEL: "bg.panel", // パネル背景
    PANEL_SUBTLE: "bg.panel/50", // 微細なパネル背景
    ELEVATED: "bg.elevated", // 浮遊要素背景
    // ゲーム専用
    GAME_AREA: "bg.panel", // ゲームエリア
    HAND_AREA: "bg.panel/30", // 手札エリア
    BOARD_AREA: "transparent", // カードボード（背景なし）
  },

  // DPIスケール検出
  MEDIA_QUERIES: {
    DPI_125: "(resolution: 120dpi), (resolution: 1.25dppx)",
    DPI_150: "(resolution: 144dpi), (resolution: 1.5dppx)",
  },
} as const;

// 🎯 推奨システム型定義（型安全性とIDEサポート向上）
export type UnifiedLayoutConstants = typeof UNIFIED_LAYOUT;

// 🚀 BORDER WIDTH UTILITY FUNCTIONS
// getBorderWidth: セマンティック、またはレベル指定でborder widthを取得
export function getBorderWidth(level: "SEMANTIC" | "LAYOUT" | "NONE" | "THIN" | "MEDIUM" | "THICK"): string {
  switch (level) {
    case "SEMANTIC":
      return UNIFIED_LAYOUT.BORDER.WIDTH.THIN; // SEMANTICは標準的なthinを使用
    case "LAYOUT":
      return UNIFIED_LAYOUT.BORDER.WIDTH.THIN; // LAYOUTもthinを使用
    case "NONE":
      return UNIFIED_LAYOUT.BORDER.WIDTH.NONE;
    case "THIN":
      return UNIFIED_LAYOUT.BORDER.WIDTH.THIN;
    case "MEDIUM":
      return UNIFIED_LAYOUT.BORDER.WIDTH.MEDIUM;
    case "THICK":
      return UNIFIED_LAYOUT.BORDER.WIDTH.THICK;
    default:
      return UNIFIED_LAYOUT.BORDER.WIDTH.THIN; // フォールバック
  }
}

// getDynamicBorder: 動的なボーダー設定（状態に応じてボーダーを変更）
export function getDynamicBorder(
  options: { isActive: boolean; activeContext?: string; defaultContext?: string } | boolean = false
): string {
  // backward compatibility: boolean引数の場合
  if (typeof options === "boolean") {
    return options ? UNIFIED_LAYOUT.BORDER.WIDTH.MEDIUM : UNIFIED_LAYOUT.BORDER.WIDTH.THIN;
  }
  
  // オブジェクト引数の場合
  const { isActive } = options;
  return isActive ? UNIFIED_LAYOUT.BORDER.WIDTH.MEDIUM : UNIFIED_LAYOUT.BORDER.WIDTH.THIN;
}
