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
  // 手札エリア: トランプ型カード（120px）+ 適度な高さ（DPI100%最適化）
  HAND_AREA_HEIGHT: "clamp(180px, 18dvh, 220px)",

  // 125% DPI特別対応
  DPI_125: {
    HEADER_HEIGHT: "clamp(64px, 6dvh, 96px)",
    // 125%DPI環境でもトランプ型カードに十分な高さを確保（ゲーム感重視）
    HAND_AREA_HEIGHT: "clamp(180px, 18dvh, 220px)", // 10px増やしてカード余裕確保
    // カードサイズも標準的なトランプ型を維持（統一感優先）
    CARD: {
      WIDTH: { base: "100px", md: "120px" },
      HEIGHT: { base: "140px", md: "168px" },
    },
    // 125%DPI専用スペーシング
    SPACING: {
      CARD_GAP: "14px", // 基本の12pxより少し広く
      COMPONENT_PADDING: "0.5rem 0.8rem", // コンパクト化
      SECTION_GAP: "0px",
      INNER_SPACING: "18px",
      FORM_GAP: "0.4rem",
    },
  },

  // 150% DPI特別対応（カード重なり解消＋縦方向最適化）
  DPI_150: {
    HEADER_HEIGHT: "clamp(48px, 4.5dvh, 72px)", // さらに圧縮
    HAND_AREA_HEIGHT: "clamp(140px, 12dvh, 180px)", // 盤面確保のため更に圧縮
    // 150%DPIでカード間隔問題解消のための調整
    CARD: {
      WIDTH: { base: "88px", md: "105px" }, // 実装済み値に統一
      HEIGHT: { base: "123px", md: "147px" }, // 実装済み値に統一
    },
    // 150%DPI専用スペーシング（重なり防止強化）
    SPACING: {
      CARD_GAP: "18px", // 16px → 18px（水平間隔拡大）
      ROW_GAP: "28px", // 新規：縦間隔専用（重なり完全防止）
      COMPONENT_PADDING: "10px", // さらにコンパクト化
      SECTION_GAP: "0px",
      INNER_SPACING: "24px", // 20px → 24px（大きな要素間隔拡大）
      FORM_GAP: "6px",
    },
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
    CARD_GAP: "16px", // カード間のギャップ（Vercel版準拠でより美観に）
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

  // DPIスケール検出（統一化）
  MEDIA_QUERIES: {
    DPI_125: "(min-resolution: 120dpi) and (max-resolution: 143dpi), (min-resolution: 1.25dppx) and (max-resolution: 1.49dppx)",
    DPI_150: "(min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)",
    // 旧式（後方互換性用）
    WINDOWS_125: "screen and (-webkit-device-pixel-ratio: 1.25)",
    WINDOWS_150: "screen and (-webkit-device-pixel-ratio: 1.5)",
  },

  // レスポンシブブレークポイント統一
  BREAKPOINTS: {
    MOBILE: "(max-width: 767px)", // モバイル
    TABLET: "(min-width: 768px) and (max-width: 1279px)", // タブレット
    DESKTOP: "(min-width: 1280px)", // デスクトップ
    MD_UP: "(min-width: 768px)", // md以上
    LG_DOWN: "(max-width: 1279px)", // lg以下
  },
} as const;

// 🎯 推奨システム型定義（型安全性とIDEサポート向上）
export type UnifiedLayoutConstants = typeof UNIFIED_LAYOUT;

// 🚀 BORDER WIDTH UTILITY FUNCTIONS
// getBorderWidth: セマンティック、またはレベル指定でborder widthを取得
export function getBorderWidth(
  level: "SEMANTIC" | "LAYOUT" | "NONE" | "THIN" | "MEDIUM" | "THICK"
): string {
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
  options:
    | { isActive: boolean; activeContext?: string; defaultContext?: string }
    | boolean = false
): string {
  // backward compatibility: boolean引数の場合
  if (typeof options === "boolean") {
    return options
      ? UNIFIED_LAYOUT.BORDER.WIDTH.MEDIUM
      : UNIFIED_LAYOUT.BORDER.WIDTH.THIN;
  }

  // オブジェクト引数の場合
  const { isActive } = options;
  return isActive
    ? UNIFIED_LAYOUT.BORDER.WIDTH.MEDIUM
    : UNIFIED_LAYOUT.BORDER.WIDTH.THIN;
}

// ==========================
// 🎨 UI TOKENS (Colors/Shadows/Easing)
// 2025 ベストプラクティス: 文字列の直書きを減らし可読性/一貫性を向上
// ==========================
export const UI_TOKENS = {
  COLORS: {
    // ドラクエ風の基調色
    dqBlue: "#4a9eff",
    dqPurple: "#8b5cf6",
    dqRed: "#dc2626",
    dqGold: "#d4af37",
    dqSilver: "#c0c0c0",
    // 拡張: 主要アクセント色のアルファ付き
    dqBlueAlpha30: "rgba(74,158,255,0.3)",
    dqBlueAlpha20: "rgba(74,158,255,0.2)",
    textBase: "#ffffff",
    textMuted: "rgba(255,255,255,0.7)",
    panelBg: "rgba(8,9,15,0.95)",
    panelBg80: "rgba(8,9,15,0.80)",
    panelBg60: "rgba(8,9,15,0.60)",
    // 便利なアルファ付きカラー（段階的移行用）
    whiteAlpha95: "rgba(255,255,255,0.95)",
    whiteAlpha90: "rgba(255,255,255,0.9)",
    whiteAlpha80: "rgba(255,255,255,0.8)",
    whiteAlpha60: "rgba(255,255,255,0.6)",
    whiteAlpha50: "rgba(255,255,255,0.5)",
    whiteAlpha40: "rgba(255,255,255,0.4)",
    whiteAlpha30: "rgba(255,255,255,0.3)",
    whiteAlpha20: "rgba(255,255,255,0.2)",
    whiteAlpha15: "rgba(255,255,255,0.15)",
    whiteAlpha10: "rgba(255,255,255,0.1)",
    whiteAlpha05: "rgba(255,255,255,0.05)",
    whiteAlpha02: "rgba(255,255,255,0.02)",
    whiteAlpha015: "rgba(255,255,255,0.015)",
    blackAlpha70: "rgba(0,0,0,0.7)",
    blackAlpha80: "rgba(0,0,0,0.8)",
    blackAlpha60: "rgba(0,0,0,0.6)",
    blackAlpha50: "rgba(0,0,0,0.5)",
    blackAlpha40: "rgba(0,0,0,0.4)",
    blackAlpha30: "rgba(0,0,0,0.3)",
    blackAlpha20: "rgba(0,0,0,0.2)",
    purpleAlpha80: "rgba(139, 92, 246, 0.8)",
    purpleAlpha60: "rgba(139, 92, 246, 0.6)",
    purpleAlpha40: "rgba(139, 92, 246, 0.4)",
    purpleAlpha30: "rgba(139, 92, 246, 0.3)",
    purpleAlpha25: "rgba(139, 92, 246, 0.25)",
    purpleAlpha15: "rgba(139, 92, 246, 0.15)",
    purpleAlpha04: "rgba(139, 92, 246, 0.04)",
    purpleAlpha025: "rgba(139, 92, 246, 0.025)",
    purpleAlpha02: "rgba(139, 92, 246, 0.02)",
    amberAlpha65: "rgba(217,119,6,0.65)",
    tealAlpha40: "rgba(20,184,166,0.4)",
    indigoAlpha10: "rgba(99,102,241,0.1)",
    indigoAlpha15: "rgba(99,102,241,0.15)",
    indigoAlpha08: "rgba(99,102,241,0.08)",
    indigoAlpha04: "rgba(99,102,241,0.04)",
    indigoAlpha20: "rgba(99,102,241,0.2)",
    indigoAlpha40: "rgba(99,102,241,0.4)",
    // 通知・フェーズ用の強調色
    accentGold: "rgba(255,215,0,0.9)",
    skyBlue: "rgba(135,206,250,0.9)",
    orangeRed: "rgba(255,69,0,0.9)",
    violet: "rgba(147,112,219,0.9)",
    limeGreen: "rgba(50,205,50,0.9)",
  },
  EASING: {
    hover: "cubic-bezier(0.4, 0, 0.2, 1)",
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  SHADOWS: {
    cardRaised:
      "0 4px 16px -4px rgba(0,0,0,0.25), 0 2px 8px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
    cardFloating:
      "0 8px 24px -8px rgba(0,0,0,0.35), 0 4px 12px -4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
    panelSubtle: "0 2px 8px rgba(0,0,0,0.25)",
    panelDistinct:
      "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.4), 0 6px 12px rgba(0,0,0,0.3)",
    activeArea: "inset 0 0 12px rgba(139, 92, 246, 0.25)",
    // ホバー/リング表現（カード/状態用）
    cardHover:
      "0 12px 28px -8px rgba(0,0,0,0.45), 0 6px 14px -4px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)",
    ringPurpleMild: "0 0 0 2px rgba(139,92,246,0.18)",
    ringPurpleStrong: "0 0 0 3px rgba(139,92,246,0.35)",
    ringAmber: "0 0 0 1px rgba(217,119,6,0.65)",
  },
  TEXT_SHADOWS: {
    soft: "0 1px 2px rgba(0,0,0,0.5)",
    none: "none",
    heroGold:
      "0 0 8px rgba(255,215,0,0.6), 0 0 16px rgba(255,215,0,0.4), 1px 1px 0 rgba(0,0,0,0.8)",
  },
  GRADIENTS: {
    deepBlue: "linear-gradient(137deg, rgba(0,48,112,0.95), rgba(0,32,80,0.98))", // AI感除去: 135deg → 137deg
    deepBlueHover: "linear-gradient(137deg, rgba(0,60,140,0.98), rgba(0,40,100,1))", // AI感除去: 135deg → 137deg
    deepBlueActive: "linear-gradient(137deg, rgba(0,36,84,0.95), rgba(0,24,60,0.98))", // AI感除去: 135deg → 137deg
    forestGreen: "linear-gradient(137deg, rgba(16,112,48,0.95), rgba(8,80,32,0.98))", // AI感除去: 135deg → 137deg
    forestGreenHover: "linear-gradient(137deg, rgba(32,148,64,0.98), rgba(16,112,48,1))", // AI感除去: 135deg → 137deg
    forestGreenActive: "linear-gradient(137deg, rgba(8,80,32,1), rgba(4,64,24,1))", // AI感除去: 135deg → 137deg
    royalPurple: "linear-gradient(137deg, rgba(48,16,112,0.95), rgba(32,8,80,0.98))", // AI感除去: 135deg → 137deg
    royalPurpleHover: "linear-gradient(137deg, rgba(64,32,148,0.98), rgba(48,16,112,1))", // AI感除去: 135deg → 137deg
    royalPurpleActive: "linear-gradient(137deg, rgba(32,8,80,1), rgba(24,4,64,1))", // AI感除去: 135deg → 137deg
    orangeSunset: "linear-gradient(137deg, rgba(112,48,16,0.95), rgba(80,32,8,0.98))", // AI感除去: 135deg → 137deg
    orangeSunsetHover: "linear-gradient(137deg, rgba(148,64,32,0.98), rgba(112,48,16,1))", // AI感除去: 135deg → 137deg
    orangeSunsetActive: "linear-gradient(137deg, rgba(80,32,8,1), rgba(64,24,4,1))", // AI感除去: 135deg → 137deg
    dqPanel:
      "linear-gradient(137deg, rgba(8,9,15,0.88) 0%, rgba(12,14,22,0.90) 50%, rgba(8,9,15,0.88) 100%)", // AI感除去: 135deg → 137deg
  },
  // ボタン影の段階表現
  BUTTON_SHADOWS: {
    flat: "inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.25)",
    raised: "0 4px 10px rgba(0,0,0,0.25)",
    hover: "0 6px 12px rgba(0,0,0,0.3)",
    active: "inset 0 3px 0 rgba(0,0,0,0.2)",
    subtle: "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.3)",
  },
  FILTERS: {
    dropShadowSoft: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    dropShadowStrong: "drop-shadow(0 8px 20px rgba(0,0,0,0.35))",
  },
} as const;

export type UITokens = typeof UI_TOKENS;
