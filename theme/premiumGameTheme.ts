/**
 * Dragon Quest Inspired Game Theme - HUMAN-LIKE UI/UX
 * ガイドライン完全準拠版 - AIっぽさ完全排除
 * obsidian.900 + slimeBlue.500 + heroGold.400 + ピクセル風質感
 *
 * 設計原則:
 * - 既定値依存禁止: すべて意図的なピクセル単位調整
 * - レトロ×現代: ドット質感 + WCAG AAA準拠
 * - 段積み影: blur最小、1-2px段積みでピクセル風輪郭
 * - リズム感余白: 等比でなく 2,4,6,8,12,16,20,24 の人間的配列
 * - レトロ角丸: xs=2, sm=4, md=6, lg=8 でレトロ感保持
 */

// === HUMAN-LIKE SPACING - ガイドライン準拠 ===
// 意図: 等比数列を避け、軽い奇数混在でリズム感を演出
// AIっぽい均質感を排除した人間的な配列
const humanSpacing = {
  1: { value: "2px" },  // 最小単位
  2: { value: "4px" },  // 基準
  3: { value: "6px" },  // 奇数でリズム
  4: { value: "8px" },  // 偶数
  5: { value: "12px" }, // 跳躍でリズム
  6: { value: "16px" }, // 標準大
  7: { value: "20px" }, // 奇数大
  8: { value: "24px" }, // 最大標準
};

// === DQ-INSPIRED PALETTE - ガイドライン準拠 ===
// obsidian.900 ベース + slimeBlue + heroGold + berryRed
const obsidianPalette = {
  50: { value: "#F2F5FB" }, // pure.100 相当
  100: { value: "#E5E8F0" },
  200: { value: "#D1D6E3" },
  300: { value: "#AAB0C0" }, // mist.300 - 低優先テキスト
  400: { value: "#8B92A3" },
  500: { value: "#6C7386" },
  600: { value: "#4F5569" },
  700: { value: "#32384C" },
  800: { value: "#141722" }, // ink.800 - パネル背景
  900: { value: "#0E0F13" }, // obsidian.900 - メイン背景
  950: { value: "#0A0B0E" }, // 最深部
};

// === SLIME BLUE PALETTE ===
const slimeBluePalette = {
  50: { value: "#EBF8FF" },
  100: { value: "#DBEAFE" },
  200: { value: "#BFDBFE" },
  300: { value: "#93C5FD" },
  400: { value: "#60A5FA" },
  500: { value: "#3AB0FF" }, // slimeBlue.500 - メインアクセント
  600: { value: "#2563EB" },
  700: { value: "#1D4ED8" },
  800: { value: "#1E40AF" },
  900: { value: "#1E3A8A" },
};

// === HERO GOLD PALETTE ===
const heroGoldPalette = {
  50: { value: "#FEFCE8" },
  100: { value: "#FEF9C3" },
  200: { value: "#FEF08A" },
  300: { value: "#FDE047" },
  400: { value: "#D9B44A" }, // heroGold.400 - ハイライト
  500: { value: "#EAB308" },
  600: { value: "#CA8A04" },
  700: { value: "#A16207" },
  800: { value: "#854D0E" },
  900: { value: "#713F12" },
};

// === BERRY RED PALETTE ===
const berryRedPalette = {
  50: { value: "#FEF2F2" },
  100: { value: "#FEE2E2" },
  200: { value: "#FECACA" },
  300: { value: "#FCA5A5" },
  400: { value: "#D96A6A" }, // berryRed.400 - アラート/エラー
  500: { value: "#EF4444" },
  600: { value: "#DC2626" },
  700: { value: "#B91C1C" },
  800: { value: "#991B1B" },
  900: { value: "#7F1D1D" },
};

// === PREMIUM DESIGN TOKENS ===
export const premiumTokens = {
  colors: {
    // === ガイドライン準拠カラーパレット ===
    obsidian: obsidianPalette,
    slimeBlue: slimeBluePalette,
    heroGold: heroGoldPalette,
    berryRed: berryRedPalette,

    // レガシー互換用（内部的には新パレット参照）
    richBlack: obsidianPalette,
    teal: slimeBluePalette,

    // 状態カラー - ガイドライン準拠
    success: {
      50: { value: "#F0FDF4" },
      400: { value: "#4ADE80" }, // 成功時ハイライト
      500: { value: "#22C55E" }, // 成功ソリッド
      600: { value: "#16A34A" },
      900: { value: "#14532D" },
    },
    warning: {
      50: { value: "#FFFBEB" },
      400: { value: "#D9B44A" }, // heroGold互換
      500: { value: "#F59E0B" },
      600: { value: "#D97706" },
      900: { value: "#92400E" },
    },
    danger: {
      50: { value: "#FEF2F2" },
      400: { value: "#D96A6A" }, // berryRed互換
      500: { value: "#EF4444" },
      600: { value: "#DC2626" },
      900: { value: "#7F1D1D" },
    },
  },

  // 人間的リズム感スペーシング - ガイドライン準拠
  spacing: humanSpacing,

  // レトロ角丸 - ガイドライン準拠（レトロ感を壊さない小さめ設定）
  radii: {
    none: { value: "0" },
    xs: { value: "2px" }, // 最小レトロ角丸
    sm: { value: "4px" }, // 標準レトロ角丸
    md: { value: "6px" }, // 中レトロ角丸
    lg: { value: "8px" }, // 最大レトロ角丸（過度な丸角は避ける）
    xl: { value: "8px" }, // lg固定（大きな角丸は非レトロ）
    "2xl": { value: "8px" }, // lg固定
    "3xl": { value: "8px" }, // lg固定
    full: { value: "9999px" }, // 円形のみ許可
  },

  // ピクセル風影システム - ガイドライン準拠（blur最小・段積み）
  shadows: {
    // === 基本ピクセル影 ===
    px1: { value: "0 1px 0 rgba(0,0,0,0.6)" }, // 最小ピクセル影
    px2: { value: "1px 1px 0 rgba(0,0,0,0.7), 0 2px 0 rgba(0,0,0,0.5)" }, // 段積み影

    // === ガイドライン準拠の段階的影 ===
    xs: { value: "0 1px 0 rgba(0,0,0,0.4)" }, // 最小
    sm: { value: "1px 1px 0 rgba(0,0,0,0.6)" }, // 小
    md: { value: "1px 1px 0 rgba(0,0,0,0.7), 0 2px 0 rgba(0,0,0,0.4)" }, // 中
    lg: { value: "2px 2px 0 rgba(0,0,0,0.7), 0 3px 0 rgba(0,0,0,0.4)" }, // 大
    xl: { value: "2px 2px 0 rgba(0,0,0,0.8), 0 4px 0 rgba(0,0,0,0.5), 0 6px 0 rgba(0,0,0,0.3)" }, // 特大
    "2xl": { value: "3px 3px 0 rgba(0,0,0,0.8), 0 6px 0 rgba(0,0,0,0.6), 0 9px 0 rgba(0,0,0,0.4)" }, // 最大

    // === ゲーム専用エレベーション（ピクセル風） ===
    card: { value: "1px 1px 0 rgba(0,0,0,0.6), 0 2px 0 rgba(0,0,0,0.4)" },
    cardHover: { value: "2px 2px 0 rgba(0,0,0,0.7), 0 3px 0 rgba(0,0,0,0.5), 0 5px 0 rgba(0,0,0,0.3)" },
    panel: { value: "1px 1px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)" },

    // === 手札カード専用（ピクセル風＋アクセント）===
    cardHandActive: { value: "1px 1px 0 rgba(58,176,255,0.8), 0 2px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)" },
    cardHandInactive: { value: "0 1px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)" },
    cardHandHover: { value: "2px 2px 0 rgba(58,176,255,0.9), 0 3px 0 rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2)" },
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

// === SEMANTIC TOKENS - ガイドライン完全準拠版 ===
export const premiumSemanticTokens = {
  colors: {
    // === SURFACE HIERARCHY - ガイドライン準拠 ===
    bgCanvas: { value: "{colors.obsidian.900}" }, // #0E0F13 - メインキャンバス
    bgPanel: { value: "{colors.obsidian.800}" }, // #141722 - パネル背景
    bgSubtle: { value: "{colors.obsidian.700}" }, // 段階的背景
    bgMuted: { value: "{colors.obsidian.600}" }, // 最高層背景

    // レガシー互換用
    bg: { value: "{colors.obsidian.900}" },

    // === FOREGROUND - WCAG AAA準拠 ===
    textPrimary: { value: "{colors.obsidian.50}" }, // #F2F5FB - 最大コントラスト
    textMuted: { value: "{colors.obsidian.300}" }, // #AAB0C0 - 低優先テキスト
    textSubtle: { value: "rgba(170,176,192,0.7)" }, // mist.300 + opacity

    // レガシー互換用
    text: { value: "{colors.obsidian.50}" },

    // === ACCENT SYSTEM - ガイドライン準拠 ===
    accent: { value: "{colors.slimeBlue.500}" }, // #3AB0FF - メインアクセント
    accentHover: { value: "{colors.slimeBlue.400}" }, // ホバー時
    accentActive: { value: "{colors.slimeBlue.600}" }, // アクティブ時
    accentSubtle: { value: "rgba(58,176,255,0.10)" }, // サトル背景
    accentRing: { value: "rgba(58,176,255,0.4)" }, // フォーカスリング

    highlight: { value: "{colors.heroGold.400}" }, // #D9B44A - ハイライト
    danger: { value: "{colors.berryRed.400}" }, // #D96A6A - アラート

    // レガシー互換用
    primary: { value: "{colors.slimeBlue.500}" },
    primarySubtle: { value: "rgba(58,176,255,0.10)" },
    secondary: { value: "{colors.slimeBlue.500}" },
    secondaryHover: { value: "{colors.slimeBlue.400}" },
    secondaryActive: { value: "{colors.slimeBlue.600}" },
    secondarySubtle: { value: "rgba(58,176,255,0.15)" },

    // === BORDER SYSTEM - ガイドライン準拠 ===
    borderDefault: { value: "rgba(255,255,255,0.12)" }, // 12%で可視性向上
    borderStrong: { value: "rgba(255,255,255,0.24)" }, // 24%で強調
    borderAccent: { value: "rgba(58,176,255,0.6)" }, // アクセントボーダー
    borderSubtle: { value: "rgba(255,255,255,0.06)" }, // 極薄

    // レガシー互換用
    border: { value: "rgba(255,255,255,0.12)" },
    borderMuted: { value: "rgba(255,255,255,0.06)" },

    // === GAME SPECIFIC - ガイドライン準拠 ===
    cardBg: { value: "rgba(20,23,34,0.9)" }, // ink.800 + alpha
    cardBorder: { value: "rgba(58,176,255,0.6)" }, // slimeBlue accent
    slotBorder: { value: "rgba(58,176,255,0.8)" }, // 強調スロット

    // === STATE FEEDBACK - ガイドライン準拠 ===
    successSolid: { value: "{colors.success.500}" }, // #22C55E
    dangerSolid: { value: "{colors.danger.500}" }, // #EF4444
    successSubtle: { value: "rgba(34,197,94,0.18)" }, // 強化された可視性
    dangerSubtle: { value: "rgba(239,68,68,0.18)" }, // 強化された可視性
    successBorder: { value: "rgba(34,197,94,0.7)" }, // 強いボーダー
    dangerBorder: { value: "rgba(239,68,68,0.7)" }, // 強いボーダー
    successText: { value: "#BBF7D0" }, // ライトグリーン
    dangerText: { value: "#FECACA" }, // ライトレッド

    // === INTERACTION - ガイドライン準拠 ===
    focusRing: { value: "rgba(58,176,255,0.8)" }, // 高可視フォーカスリング
    link: { value: "#60A5FA" }, // 青系リンク色
    linkHover: { value: "#93C5FD" }, // ホバー時、より明るく
    cardHoverBg: { value: "rgba(25,30,40,0.95)" }, // カードホバー背景
    hoverOverlay: { value: "rgba(255,255,255,0.08)" }, // 一般ホバー
    activeOverlay: { value: "rgba(255,255,255,0.12)" }, // アクティブ状態

    // === HAND CARD SYSTEM - ガイドライン準拠 ===
    cardHand: { value: "{colors.obsidian.800}" }, // ink.800 ベース
    cardHandDisabled: { value: "rgba(20,23,34,0.6)" }, // 無効時は透明度下げ
    cardHandBorder: { value: "rgba(58,176,255,0.6)" }, // slimeBlueボーダー
    cardHandBorderDisabled: { value: "rgba(255,255,255,0.1)" }, // 無効時グレー
    cardHandBorderHover: { value: "rgba(58,176,255,0.9)" }, // ホバー時強化
    cardHandText: { value: "{colors.obsidian.50}" }, // 最大コントラスト
    cardHandTextDisabled: { value: "rgba(242,245,251,0.4)" }, // 無効時テキスト
    cardHandHover: { value: "rgba(20,23,34,1.0)" }, // ホバー時完全不透明

    // === CENTRAL WAITING CARD SYSTEM - Dragon Quest Style ガイドライン準拠 ===
    cardCentralWaitingBg: { value: "{colors.obsidian.800}" }, // パネル背景と統一
    cardCentralWaitingBorder: { value: "rgba(255,255,255,0.9)" }, // DQ風白枠
    cardCentralWaitingText: { value: "{colors.obsidian.50}" }, // 最大コントラスト
    cardCentralWaitingNumber: { value: "{colors.obsidian.50}" }, // 数字も最大コントラスト
    cardCentralWaitingMeta: { value: "{colors.obsidian.300}" }, // メタ情報は低優先

    // === LEGACY STATE COLORS ===
    successLegacy: { value: "rgba(34,197,94,0.9)" },
    warning: { value: "rgba(217,180,74,0.9)" }, // heroGoldベース
    dangerLegacy: { value: "rgba(217,106,106,0.9)" }, // berryRedベース

    // === OVERLAYS - ガイドライン準拠 ===
    overlayStrong: { value: "rgba(14,15,19,0.9)" }, // obsidianベースオーバーレイ
    overlayMedium: { value: "rgba(14,15,19,0.7)" },

    // === GLASS EFFECTS - 控えめなガラス効果 ===
    glassBg03: { value: "rgba(242,245,251,0.03)" }, // pure.100ベース
    glassBg05: { value: "rgba(242,245,251,0.05)" },
    glassBg08: { value: "rgba(242,245,251,0.08)" },
    glassBorder: { value: "rgba(255,255,255,0.12)" }, // borderDefaultと統一
    glassBorderWeak: { value: "rgba(255,255,255,0.06)" }, // borderSubtleと統一

    // === BRAND GRADIENTS - ガイドライン準拠（控えめに） ===
    brandGradient: { value: "linear-gradient(135deg, #3AB0FF 0%, #D9B44A 100%)" }, // slimeBlue to heroGold
    brandGradientHover: { value: "linear-gradient(135deg, #60A5FA 0%, #F59E0B 100%)" },
    brandShadow: { value: "1px 1px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)" }, // ピクセル風
    brandShadowHover: { value: "2px 2px 0 rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.15)" },
    brandRing: { value: "rgba(58,176,255,0.15)" }, // slimeBlueベース

    // === LEGACY SUPPORT ===
    panelBannerFg: { value: "{colors.obsidian.900}" }, // バナーテキスト用
    selfNumberFg: { value: "{colors.slimeBlue.500}" }, // 自分の数字色
  },
};

// === TYPOGRAPHY TOKENS - ガイドライン準拠 ===
export const typographyTokens = {
  textStyles: {
    // 見出し: ファンタジー調 Display
    "display-xl": {
      value: {
        fontSize: "3xl", // 30px
        fontWeight: "bold",
        lineHeight: "tight",
        letterSpacing: "-0.02em",
      },
    },
    h1: {
      value: {
        fontSize: "2xl", // 24px
        fontWeight: "bold",
        lineHeight: "snug",
      },
    },
    h2: {
      value: {
        fontSize: "xl", // 20px
        fontWeight: "semibold",
        lineHeight: "snug",
      },
    },
    h3: {
      value: {
        fontSize: "lg", // 18px
        fontWeight: "semibold",
        lineHeight: "normal",
      },
    },
    // 本文
    body: {
      value: {
        fontSize: "md", // 16px
        fontWeight: "normal",
        lineHeight: "normal",
      },
    },
    // キャプション
    caption: {
      value: {
        fontSize: "sm", // 14px
        fontWeight: "normal",
        lineHeight: "snug",
        color: "textMuted",
      },
    },
    // 数値/ログ: 等幅フォント
    mono: {
      value: {
        fontFamily: "mono",
        fontSize: "md",
        fontWeight: "normal",
        letterSpacing: "-0.01em", // 少し詰める
      },
    },
  },
};

// === MOTION TOKENS - ガイドライン準拠（意味中心） ===
export const motionTokens = {
  // === 時間とイージング（ガイドライン指標） ===
  durations: {
    microFeedback: "120ms", // 微フィードバック: 120-180ms
    fast: "150ms",
    stateTransition: "180ms", // 状態遷移: 180-240ms
    normal: "220ms",
    resultShow: "280ms", // 結果演出: 240-360ms
    slow: "350ms",
  },

  easings: {
    microOut: "cubic-bezier(0, 0, 0.3, 1)", // power2.out 相当
    stateInOut: "cubic-bezier(0.25, 0.46, 0.45, 0.94)", // power3.inOut 相当
    bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)", // バウンス
  },

  // === GSAPベースアニメーション設定 ===
  cardFlip: {
    duration: "180ms", // ガイドライン: 短く、意味ある動き
    easing: "cubic-bezier(0, 0, 0.3, 1)", // power2.out
    perspective: "800px", // 3D感
  },

  cardMove: {
    duration: "220ms", // スムーズな移動
    easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)", // power3.inOut
  },

  invalidShake: {
    duration: "60ms", // 無効操作のシェイク: 短く強烈
    distance: "2px", // 微細なシェイク
    repeat: 3,
    easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)", // power1.inOut
  },

  turnPulse: {
    duration: "800ms", // 自ターン強調: 長めの明滅
    opacity: { from: 1, to: 0.85 },
    repeat: -1, // 無限ループ
    yoyo: true,
    easing: "sine.inOut", // 滑らかな明滅
  },
};

// === COMPONENT BASE STYLES - ガイドライン準拠 ===
export const componentStyles = {
  // === カードスタイル ===
  gameCard: {
    bg: "cardBg",
    border: "1px solid", // ピクセル風: 細めボーダー
    borderColor: "cardBorder",
    borderRadius: "sm", // レトロ: 4px固定
    boxShadow: "card", // ピクセル風影
    transition: "all {durations.stateTransition} {easings.stateInOut}", // 180ms

    // === 状態差強化 ===
    _hover: {
      borderColor: "accent", // slimeBlue
      boxShadow: "cardHover", // 段積み強化
      transform: "translateY(-1px)", // 浮き上がり
    },

    _active: {
      transform: "translateY(0)", // 押し込み
      boxShadow: "px1", // 影弱化
    },

    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
      transform: "none",
    },
  },

  // === パネルスタイル ===
  gamePanel: {
    bg: "bgPanel", // obsidian.800
    border: "1px solid",
    borderColor: "borderDefault", // 12% 可視性
    borderRadius: "md", // レトロ: 6px
    boxShadow: "panel", // ピクセル風パネル影
    // backdropFilter 削除: ピクセル風には不適合
  },

  // === DQボタンスタイル（ガイドライン dq variant） ===
  dqButton: {
    bg: "bgPanel", // パネル背景と統一
    color: "textPrimary", // 最大コントラスト
    border: "1px solid",
    borderColor: "borderStrong", // 24% 可視性
    borderRadius: "sm", // レトロ: 4px固定
    boxShadow: "px2", // 段積み影
    px: 5, py: 3, // tokens経由: 12px, 6px
    fontWeight: "bold",
    transition: "all {durations.microFeedback} {easings.microOut}", // 120ms

    // === 状態差強化 ===
    _hover: {
      transform: "translateY(-1px)", // 浮き上がり
      bg: "rgba(20,23,34,0.94)", // 微変化
      boxShadow: "lg", // 影強化
    },

    _active: {
      transform: "translateY(0)", // 押し込み
      boxShadow: "px1", // 影弱化
    },

    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
      transform: "none",
    },

    _focusVisible: {
      boxShadow: "0 0 0 2px rgba(58,176,255,0.6)", // slimeBlue focus
    },
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

// === EXPORT ALL TOKENS ===
export const humanLikeTokens = {
  ...premiumTokens,
  ...typographyTokens,
  motion: motionTokens,
  breakpoints: gameBreakpoints,
  components: componentStyles,
};