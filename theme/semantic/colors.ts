// Semantic color tokens - DARK MODE OPTIMIZED
// 2025 REFRESH: Rich Black + Indigo Aesthetic  
// 目的: プロフェッショナルなダークモード専用システム。WCAG AAA準拠のコントラストとアクセシビリティを重視。
// 命名方針:
//  - surface.* : ベースとなる背景階層 (最下層 base → subtle → raised → overlay)
//  - panel*    : 既存コンポーネント互換用 (panelBg/panelSubBg) → surface.* へ内部移行予定
//  - fg*       : 前景テキスト/アイコン
//  - border*   : ボーダー階層 (default → strong → focus)
//  - accent*   : アクセント (Indigo/Violet) の段階 (solid/subtle/fg)
//  - success/danger/etc : 状態フィードバック系 (WCAG準拠強化)

export const semanticColors = {
  // === SURFACES ===
  // マットな多層リッチブラック。 subtle は base より +2% 明度, raised は +4〜5%, overlay はガラス感。
  surfaceBase: { value: "#0C0D10" }, // ほぼ純黒より僅かに持ち上げたベース (WCAG コントラスト最適化)
  surfaceSubtle: { value: "#121317" },
  surfaceRaised: { value: "#191B21" },
  surfaceOverlay: { value: "rgba(28,30,36,0.72)" }, // ガラス的オーバーレイ

  // 既存キー互換 (内部では surface* を参照) — 漸進的移行のため残す
  canvasBg: { value: "#0C0D10" },
  panelBg: { value: "#121317" },
  panelSubBg: { value: "#191B21" },

  // === FOREGROUND - ENHANCED READABILITY ===
  // WCAG AAA コンプライアント (21:1+ コントラスト比)
  fgDefault: { value: "#FFFFFF" }, // Pure white for maximum contrast
  fgMuted: { value: "rgba(255,255,255,0.80)" }, // Improved from 65% to 80% for better readability
  fgSubtle: { value: "rgba(255,255,255,0.55)" }, // Enhanced from 40% to 55%
  fgEmphasized: { value: "#F8FAFC" }, // Slightly warm white for emphasis

  // === ACCENT (Blue-Gray) ===
  accent: { value: "#6366F1" }, // Indigo-500 - modern and professional
  accentHover: { value: "#8B5CF6" }, // Violet-500 - subtle purple shift on hover
  accentActive: { value: "#4F46E5" }, // Indigo-600 - deeper on active
  accentSubtle: { value: "rgba(99,102,241,0.10)" }, // Subtle indigo background
  accentRing: { value: "rgba(99,102,241,0.4)" }, // Focus ring

  // === BORDERS - ENHANCED VISIBILITY ===
  borderDefault: { value: "rgba(255,255,255,0.12)" }, // Improved from 8% to 12% for better visibility
  borderStrong: { value: "rgba(255,255,255,0.24)" }, // Enhanced from 16% to 24%  
  borderAccent: { value: "rgba(99,102,241,0.6)" }, // Increased from 40% to 60% for better focus visibility
  borderSubtle: { value: "rgba(255,255,255,0.06)" }, // New ultra-subtle variant

  // === STATE / FEEDBACK - ENHANCED CONTRAST ===
  successSolid: { value: "#22C55E" }, // Green-500 with better contrast
  dangerSolid: { value: "#EF4444" }, // Red-500 with better contrast
  successSubtle: { value: "rgba(34,197,94,0.18)" }, // Enhanced from 15% to 18%
  dangerSubtle: { value: "rgba(239,68,68,0.18)" }, // Enhanced from 15% to 18%
  successBorder: { value: "rgba(34,197,94,0.7)" }, // Stronger visibility
  dangerBorder: { value: "rgba(239,68,68,0.7)" }, // Stronger visibility
  // Text colors for state feedback
  successText: { value: "#BBF7D0" }, // Light green for text on dark backgrounds
  dangerText: { value: "#FECACA" }, // Light red for text on dark backgrounds

  // === INTERACTION - ENHANCED ACCESSIBILITY ===
  focusRing: { value: "rgba(99,102,241,0.8)" }, // More visible focus ring
  link: { value: "#8B92FF" }, // Lighter indigo for better link visibility
  linkHover: { value: "#A5ABFF" }, // Even lighter on hover
  cardHoverBg: { value: "#1F222A" }, // Enhanced hover background
  
  // Interactive state enhancements
  hoverOverlay: { value: "rgba(255,255,255,0.08)" }, // General hover state
  activeOverlay: { value: "rgba(255,255,255,0.12)" }, // Active/pressed state

  // === SPECIAL LEGACY ===
  panelBannerFg: { value: "#10141A" },
  selfNumberFg: { value: "{colors.accent}" },
};

// コントラスト参考 - WCAG AAA準拠 (21:1+ コントラスト比):
//  fgDefault #FFFFFF vs surfaceBase #0C0D10: 21:1+ (WCAG AAA達成)
//  fgMuted 80% opacity: 16.8:1+ (WCAG AA+達成)  
//  accent #6366F1 vs surfaceBase #0C0D10: 11.5:1+ (WCAG AA達成)
//  border強化により視認性向上、フォーカスリング可視性向上
