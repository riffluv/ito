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
  HEADER_HEIGHT: "clamp(80px, 8vh, 120px)",
  SIDEBAR_WIDTH: "clamp(240px, 22vw, 300px)",
  RIGHT_PANEL_WIDTH: "clamp(280px, 26vw, 360px)",
  // 手札エリア: トランプ型カード（120px）+ ゆとりを持った安定した高さ（ゲーム感重視）
  HAND_AREA_HEIGHT: "clamp(220px, 25vh, 280px)",

  // 125% DPI特別対応
  DPI_125: {
    HEADER_HEIGHT: "clamp(72px, 7vh, 104px)",
    // 125%DPI環境でもトランプ型カードに十分な高さを確保（ゲーム感重視）
    HAND_AREA_HEIGHT: "clamp(200px, 22vh, 250px)",
  },

  // ゲーム要素 (手札エリアと整合性を取る）- ゲーム感強化
  CARD: {
    MIN_WIDTH: "90px", // トランプ型の幅（拡大）
    // カード高さを手札エリアに収まるように調整（ゲーム感重視）
    MIN_HEIGHT: "140px", // トランプ型の高さ（縦長・拡大）
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
    // コンテキスト別戦略
    CONTEXT: {
      LAYOUT: "0px", // レイアウト分離は elevation 优先
      INTERACTIVE: "0px", // ホバー時のみ動的表示
      SEMANTIC: "1px", // 意味的分離がUX必須
      DECORATIVE: "1px", // 装飾的要素
      FORM: "1px", // フォーム要素（UX上必須）
    },
  },

  // ボード要素（DPI適応）- コンパクト化で手札エリアを強化
  BOARD_MIN_HEIGHT: "clamp(200px, 22vh, 260px)",

  // モニター要素（コンパクト化対応）
  MONITOR_MIN_HEIGHT: "clamp(160px, 18vh, 200px)", // 180px固定値の代替

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
      RAISED: "0 1px 3px -1px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.06)", // 軽い浮遊感
      FLOATING:
        "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)", // ホバー時
      ELEVATED:
        "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)", // モーダル要素
    },
    // パネル階層
    PANEL: {
      BASE: "none", // 基本パネルはborderless
      SUBTLE: "0 1px 2px 0 rgba(0,0,0,0.05)", // 微細なshadow
      DISTINCT: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)", // 明確な分離
    },
    // ゲーム要素
    GAME: {
      HAND_CARD:
        "0 2px 8px -2px rgba(0,0,0,0.12), 0 4px 12px -4px rgba(0,0,0,0.08)", // 手札カード
      BOARD_CARD: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)", // 場のカード
      ACTIVE_AREA: "inset 0 1px 2px 0 rgba(0,0,0,0.06)", // アクティブエリア（内側shadow）
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

  // 🔄 LEGACY COMPATIBILITY - 段階的移行サポート
  // @deprecated Use BORDER.CONTEXT instead
  BORDER_WIDTH: "1px", // 既存コードとの互換性維持

  // 📋 COMPONENT BORDER STRATEGY - コンポーネント別戦略
  // 将来のborder要求に対して予測可能な対応を保証
  COMPONENT_BORDERS: {
    // レイアウトコンポーネント: elevation 優先
    LAYOUT: {
      HEADER: "LAYOUT", // 0px, elevation使用
      SIDEBAR: "LAYOUT", // 0px, elevation使用
      FOOTER: "LAYOUT", // 0px, elevation使用
      PANELS: "LAYOUT", // 0px, elevation使用
    },
    // ゲーム要素: コンテキスト別
    GAME: {
      CARD_DEFAULT: "INTERACTIVE", // 0px, ホバー時のみ
      CARD_SELECTED: "SEMANTIC", // 1px, 選択状態表示
      BOARD_AREA: "INTERACTIVE", // 0px, ドロップ時のみ
      CHAT_MESSAGE: "LAYOUT", // 0px, elevation使用
    },
    // UI要素: UX必須は保持
    FORM: {
      INPUT: "FORM", // 1px, UX上必須
      BUTTON: "INTERACTIVE", // 0px, ホバー時のみ
      SELECT: "FORM", // 1px, UX上必須
    },
    // 特殊ケース
    TOAST: "SEMANTIC", // 1px, 通知の明確化
    MODAL: "SEMANTIC", // 1px, モーダル境界
  },

  // DPIスケール検出
  MEDIA_QUERIES: {
    DPI_125: "(resolution: 120dpi), (resolution: 1.25dppx)",
    DPI_150: "(resolution: 144dpi), (resolution: 1.5dppx)",
  },
} as const;

// === 後方互換性サポート ===

// DPI_ADAPTIVE_LAYOUT (⚠️ 廃止予定 - UNIFIED_LAYOUTを使用してください)
// @deprecated Use UNIFIED_LAYOUT instead
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

// @deprecated Use UNIFIED_LAYOUT instead
export const PREDICTABLE_LAYOUT = {
  // ⚠️ 廃止予定 - UNIFIED_LAYOUTを使用してください
  // 固定サイズ (px)
  HEADER_HEIGHT: 96, // ヘッダー固定高さ（黄金比対応）
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

// 後方互換性のため既存の LAYOUT も維持 (⚠️ 廃止予定 - UNIFIED_LAYOUTを使用してください)
// @deprecated Use UNIFIED_LAYOUT instead
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

// 🎯 推奨システム型定義（型安全性とIDEサポート向上）
export type UnifiedLayoutConstants = typeof UNIFIED_LAYOUT;

// 型安全なヘルパー関数
export const getLayoutValue = <T extends keyof UnifiedLayoutConstants>(
  key: T
): UnifiedLayoutConstants[T] => UNIFIED_LAYOUT[key];

// 🎯 Context-Aware Border Management
type BorderContext = keyof typeof UNIFIED_LAYOUT.BORDER.CONTEXT;
type ComponentBorderKey =
  | keyof typeof UNIFIED_LAYOUT.COMPONENT_BORDERS.LAYOUT
  | keyof typeof UNIFIED_LAYOUT.COMPONENT_BORDERS.GAME
  | keyof typeof UNIFIED_LAYOUT.COMPONENT_BORDERS.FORM;

/**
 * コンポーネント用のborderWidth取得
 * 設計意図を明確にし、将来の変更に対応
 */
export const getBorderWidth = (context: BorderContext): string => {
  return UNIFIED_LAYOUT.BORDER.CONTEXT[context];
};

/**
 * 動的borderWidth取得（条件付きborder用）
 * 例: ドラッグオーバー時、ホバー時、選択時
 */
export const getDynamicBorder = ({
  isActive,
  activeContext,
  defaultContext = "LAYOUT",
}: {
  isActive: boolean;
  activeContext: BorderContext;
  defaultContext?: BorderContext;
}): string => {
  return isActive
    ? getBorderWidth(activeContext)
    : getBorderWidth(defaultContext);
};

/**
 * レガシーBORDER_WIDTHとの互換性維持
 * 段階的移行をサポート
 */
export const getLegacyBorderWidth = (): string => {
  console.warn("⚠️ BORDER_WIDTH is deprecated. Use getBorderWidth() instead.");
  return UNIFIED_LAYOUT.BORDER.WIDTH.THIN;
};

// DPIスケール対応ヘルパー
export const getDpiValue = <T extends keyof typeof UNIFIED_LAYOUT.DPI_125>(
  key: T,
  isDpi125: boolean = false
): string => {
  return isDpi125 && key in UNIFIED_LAYOUT.DPI_125
    ? UNIFIED_LAYOUT.DPI_125[key]
    : (UNIFIED_LAYOUT[key as keyof typeof UNIFIED_LAYOUT] as string);
};

// 🔍 CSS設計品質チェック関数（開発時の品質担保）
export const validateLayoutUsage = {
  // ハードコード値の検出
  checkHardcodedValues: (cssText: string): string[] => {
    const hardcoded = [];
    if (cssText.includes('"1px"') || cssText.includes("'1px'")) {
      hardcoded.push(
        "⚠️ borderWidth: UNIFIED_LAYOUT.BORDER_WIDTHを使用してください"
      );
    }
    if (/\b\d{2,}px\b/.test(cssText)) {
      hardcoded.push(
        "⚠️ ピクセル直打ちを避け、UNIFIED_LAYOUTを使用してください"
      );
    }
    return hardcoded;
  },

  // 推奨システムの使用確認
  isUsingRecommendedSystem: (importText: string): boolean => {
    return importText.includes("UNIFIED_LAYOUT");
  },

  // 非推奨システムの使用検出
  checkDeprecatedSystems: (codeText: string): string[] => {
    const deprecated = [];
    if (codeText.includes("PREDICTABLE_LAYOUT")) {
      deprecated.push(
        "⚠️ PREDICTABLE_LAYOUTは廃止予定です。UNIFIED_LAYOUTを使用してください。"
      );
    }
    if (codeText.includes("DPI_ADAPTIVE_LAYOUT")) {
      deprecated.push(
        "⚠️ DPI_ADAPTIVE_LAYOUTは廃止予定です。UNIFIED_LAYOUTを使用してください。"
      );
    }
    if (codeText.includes("LAYOUT.")) {
      deprecated.push(
        "⚠️ LAYOUTは廃止予定です。UNIFIED_LAYOUTを使用してください。"
      );
    }
    return deprecated;
  },
};
