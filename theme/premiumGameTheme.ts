/**
 * Premium Game Theme - Chakra UI Official Inspired
 * 一流ゲームUI/UXデザイナーによる大人の洗練されたテーマ
 * リッチブラック（マット加工）+ ティールセカンダリー
 *
 * 設計原則:
 * - Chakra UI公式のような洗練された品格
 * - 黄金比を活用した美的バランス
 * - 疲れない長時間プレイ対応
 * - AIっぽさを排除した人間的な細部
 * - プロフェッショナルゲームUI基準
 */

// === GOLDEN RATIO & SOPHISTICATED SPACING ===
const PHI = 1.618; // 黄金比
const BASE_UNIT = 4; // 4px基準

// 黄金比に基づく美的スペーシング
const goldenSpacing = {
  xs: { value: `${Math.round(BASE_UNIT * 1)}px` }, // 4px
  sm: { value: `${Math.round(BASE_UNIT * PHI)}px` }, // 6px (黄金比)
  md: { value: `${Math.round(BASE_UNIT * PHI * PHI)}px` }, // 10px (黄金比²)
  lg: { value: `${Math.round(BASE_UNIT * PHI * PHI * PHI)}px` }, // 16px (黄金比³)
  xl: { value: `${Math.round(BASE_UNIT * PHI * PHI * PHI * PHI)}px` }, // 26px (黄金比⁴)
  "2xl": { value: `${Math.round(BASE_UNIT * PHI * PHI * PHI * PHI * PHI)}px` }, // 42px (黄金比⁵)
};

// === RICH BLACK PALETTE - MATTE FINISH ===
const richBlackPalette = {
  50: { value: "#f8f9fa" }, // 最も明るいニュートラル
  100: { value: "#e9ecef" }, // 明るいグレー
  200: { value: "#dee2e6" }, // ライトグレー
  300: { value: "#ced4da" }, // ミディアムライトグレー
  400: { value: "#adb5bd" }, // ミディアムグレー
  500: { value: "#6c757d" }, // ベースグレー
  600: { value: "#495057" }, // ダークグレー
  700: { value: "#343a40" }, // リッチダークグレー
  800: { value: "#232629" }, // リッチブラック（マット）
  900: { value: "#191b21" }, // ディープリッチブラック（メイン）
  950: { value: "#0f1114" }, // 最深黒
};

// === TEAL SECONDARY PALETTE ===
const tealPalette = {
  50: { value: "#f0fdfa" },
  100: { value: "#ccfbf1" },
  200: { value: "#99f6e4" },
  300: { value: "#5eead4" },
  400: { value: "#2dd4bf" },
  500: { value: "#14b8a6" }, // メインセカンダリー
  600: { value: "#0d9488" },
  700: { value: "#0f766e" },
  800: { value: "#115e59" },
  900: { value: "#134e4a" },
  950: { value: "#042f2e" },
};

// === PREMIUM DESIGN TOKENS ===
export const premiumTokens = {
  colors: {
    richBlack: richBlackPalette,
    teal: tealPalette,

    // ゲーム専用カラー
    success: {
      50: { value: "#f0fdf4" },
      500: { value: "#22c55e" },
      600: { value: "#16a34a" },
      900: { value: "#14532d" },
    },
    warning: {
      50: { value: "#fffbeb" },
      500: { value: "#f59e0b" },
      600: { value: "#d97706" },
      900: { value: "#92400e" },
    },
    danger: {
      50: { value: "#fef2f2" },
      500: { value: "#ef4444" },
      600: { value: "#dc2626" },
      900: { value: "#7f1d1d" },
    },
  },

  // 黄金比ベーススペーシング
  spacing: goldenSpacing,

  // 洗練されたボーダーラディウス（Chakra公式準拠）
  radii: {
    none: { value: "0" },
    xs: { value: "2px" },
    sm: { value: "4px" },
    md: { value: "6px" }, // Chakra公式標準
    lg: { value: "8px" },
    xl: { value: "12px" },
    "2xl": { value: "16px" },
    "3xl": { value: "24px" },
    full: { value: "9999px" },
  },

  // プロフェッショナルシャドウ（控えめで上品）
  shadows: {
    xs: { value: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" },
    sm: {
      value: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
    },
    md: {
      value:
        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    },
    lg: {
      value:
        "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    },
    xl: {
      value:
        "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    },
    "2xl": { value: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" },

    // ゲーム専用エレベーション
    card: {
      value:
        "0 2px 8px rgba(25, 27, 33, 0.12), 0 1px 3px rgba(25, 27, 33, 0.08)",
    },
    cardHover: {
      value:
        "0 8px 25px rgba(25, 27, 33, 0.18), 0 4px 12px rgba(25, 27, 33, 0.12)",
    },
    panel: {
      value:
        "0 4px 20px rgba(25, 27, 33, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    },

    // 手札カード専用シャドウ
    cardHandActive: {
      value:
        "0 4px 12px rgba(20, 184, 166, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
    },
    cardHandInactive: {
      value:
        "0 1px 3px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
    },
    cardHandHover: {
      value:
        "0 8px 20px rgba(20, 184, 166, 0.25), 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
    },
  },

  // プロタイポグラフィ（ゲームに最適化）
  fontSizes: {
    xs: { value: "0.75rem" }, // 12px
    sm: { value: "0.875rem" }, // 14px
    md: { value: "1rem" }, // 16px - ベースサイズ
    lg: { value: "1.125rem" }, // 18px
    xl: { value: "1.25rem" }, // 20px
    "2xl": { value: "1.5rem" }, // 24px
    "3xl": { value: "1.875rem" }, // 30px
    "4xl": { value: "2.25rem" }, // 36px
  },

  fontWeights: {
    normal: { value: 400 },
    medium: { value: 500 },
    semibold: { value: 600 },
    bold: { value: 700 },
  },

  // プロフェッショナルな行間（読みやすさ重視）
  lineHeights: {
    tight: { value: 1.25 },
    snug: { value: 1.375 },
    normal: { value: 1.5 },
    relaxed: { value: 1.625 },
    loose: { value: 2 },
  },
};

// === SEMANTIC TOKENS - コンテキスト駆動 ===
export const premiumSemanticTokens = {
  colors: {
    // === BASE SEMANTICS ===
    bg: {
      value: { base: "{colors.richBlack.900}", _light: "white" },
    },

    bgSubtle: {
      value: {
        base: "{colors.richBlack.800}",
        _light: "{colors.richBlack.50}",
      },
    },

    bgMuted: {
      value: {
        base: "{colors.richBlack.700}",
        _light: "{colors.richBlack.100}",
      },
    },

    // === TEXT SEMANTICS ===
    text: {
      value: {
        base: "rgba(255, 255, 255, 0.95)",
        _light: "{colors.richBlack.900}",
      },
    },

    textMuted: {
      value: {
        base: "rgba(255, 255, 255, 0.7)",
        _light: "{colors.richBlack.600}",
      },
    },

    textSubtle: {
      value: {
        base: "rgba(255, 255, 255, 0.5)",
        _light: "{colors.richBlack.500}",
      },
    },

    // === BRAND SEMANTICS ===
    primary: {
      value: { base: "{colors.teal.500}", _light: "{colors.teal.600}" },
    },

    primarySubtle: {
      value: { base: "rgba(20, 184, 166, 0.1)", _light: "{colors.teal.50}" },
    },

    // セカンダリーカラー（#14b8a6 ティール）
    secondary: {
      value: { base: "{colors.teal.500}", _light: "{colors.teal.500}" },
    },

    secondaryHover: {
      value: { base: "{colors.teal.400}", _light: "{colors.teal.600}" },
    },

    secondaryActive: {
      value: { base: "{colors.teal.600}", _light: "{colors.teal.700}" },
    },

    secondarySubtle: {
      value: {
        base: "rgba(20, 184, 166, 0.15)",
        _light: "rgba(20, 184, 166, 0.1)",
      },
    },

    // === INTERACTIVE SEMANTICS ===
    border: {
      value: {
        base: "rgba(255, 255, 255, 0.1)",
        _light: "{colors.richBlack.200}",
      },
    },

    borderMuted: {
      value: {
        base: "rgba(255, 255, 255, 0.06)",
        _light: "{colors.richBlack.100}",
      },
    },

    // === GAME SPECIFIC ===
    cardBg: {
      value: { base: "rgba(255, 255, 255, 0.08)", _light: "white" },
    },

    cardBorder: {
      value: { base: "rgba(20, 184, 166, 0.3)", _light: "{colors.teal.200}" },
    },

    slotBorder: {
      value: { base: "rgba(20, 184, 166, 0.4)", _light: "{colors.teal.300}" },
    },

    // === HAND CARD SYSTEM ===
    cardHand: {
      value: {
        base: "rgba(25, 27, 33, 0.95)",
        _light: "rgba(255, 255, 255, 0.95)",
      },
    },

    cardHandDisabled: {
      value: {
        base: "rgba(25, 27, 33, 0.6)",
        _light: "rgba(255, 255, 255, 0.6)",
      },
    },

    cardHandBorder: {
      value: { base: "rgba(20, 184, 166, 0.6)", _light: "{colors.teal.400}" },
    },

    cardHandBorderDisabled: {
      value: {
        base: "rgba(255, 255, 255, 0.1)",
        _light: "{colors.richBlack.200}",
      },
    },

    cardHandBorderHover: {
      value: { base: "rgba(20, 184, 166, 0.8)", _light: "{colors.teal.500}" },
    },

    cardHandText: {
      value: { base: "#ffffff", _light: "{colors.richBlack.900}" },
    },

    cardHandTextDisabled: {
      value: {
        base: "rgba(255, 255, 255, 0.4)",
        _light: "{colors.richBlack.400}",
      },
    },

    cardHandHover: {
      value: {
        base: "rgba(25, 27, 33, 1.0)",
        _light: "rgba(255, 255, 255, 1.0)",
      },
    },

    // === CENTRAL WAITING CARD SYSTEM - Dragon Quest Style ===
    cardCentralWaitingBg: {
      value: {
        base: "rgba(25, 27, 33, 0.85)",
        _light: "rgba(255, 255, 255, 0.85)",
      },
    },

    cardCentralWaitingBorder: {
      value: { base: "rgba(255, 255, 255, 0.9)", _light: "rgba(0, 0, 0, 0.8)" },
    },

    cardCentralWaitingText: {
      value: { base: "#ffffff", _light: "#000000" },
    },

    cardCentralWaitingNumber: {
      value: { base: "#ffffff", _light: "#000000" },
    },

    cardCentralWaitingMeta: {
      value: { base: "rgba(255, 255, 255, 0.8)", _light: "rgba(0, 0, 0, 0.7)" },
    },

    success: {
      value: { base: "rgba(34, 197, 94, 0.9)", _light: "{colors.success.600}" },
    },

    warning: {
      value: {
        base: "rgba(245, 158, 11, 0.9)",
        _light: "{colors.warning.600}",
      },
    },

    danger: {
      value: { base: "rgba(239, 68, 68, 0.9)", _light: "{colors.danger.600}" },
    },
  },
};

// === PREMIUM ANIMATIONS ===
export const premiumAnimations = {
  // 洗練されたイージング（Apple/Chakra公式準拠）
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",

  // プロフェッショナルデュレーション
  durations: {
    fast: "150ms",
    normal: "200ms",
    slow: "300ms",
    slower: "500ms",
  },

  // ゲーム専用アニメーション
  cardFlip: {
    duration: "600ms",
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },

  cardMove: {
    duration: "300ms",
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
};

// === BREAKPOINTS - ゲーム最適化 ===
export const gameBreakpoints = {
  sm: "30em", // 480px - モバイル
  md: "48em", // 768px - タブレット
  lg: "62em", // 992px - ラップトップ
  xl: "80em", // 1280px - デスクトップ
  "2xl": "96em", // 1536px - 大型ディスプレイ
};

// === PROFESSIONAL COMPONENT STYLES ===
export const premiumComponentStyles = {
  // カードスタイル
  gameCard: {
    bg: "cardBg",
    border: "1.5px solid",
    borderColor: "cardBorder",
    borderRadius: "xl",
    boxShadow: "card",
    transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",

    _hover: {
      borderColor: "primary",
      boxShadow: "cardHover",
      transform: "translateY(-2px)",
    },

    _active: {
      transform: "translateY(0) scale(0.98)",
    },
  },

  // パネルスタイル
  gamePanel: {
    bg: "bgSubtle",
    border: "1px solid",
    borderColor: "border",
    borderRadius: "2xl",
    boxShadow: "panel",
    backdropFilter: "blur(20px)",
  },

  // ボタンスタイル
  primaryButton: {
    bg: "primary",
    color: "white",
    borderRadius: "lg",
    fontWeight: "semibold",
    transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",

    _hover: {
      bg: "teal.600",
      transform: "translateY(-1px)",
      boxShadow: "lg",
    },

    _active: {
      transform: "translateY(0) scale(0.98)",
    },
  },
};
