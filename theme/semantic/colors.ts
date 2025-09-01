// Semantic color tokens (ライトモードのみ / 将来 dark 拡張時 base と _dark を追加)
// 2025 REFRESH: Rich Black + Vivid Orange Aesthetic (Chakra Official Site inspired)
// 目的: 旧ウッド/コズミック意匠を撤去し、マットで階層化されたサーフェスと鮮烈なアクセントを提供。
// 命名方針:
//  - surface.* : ベースとなる背景階層 (最下層 base → subtle → raised → overlay)
//  - panel*    : 既存コンポーネント互換用 (panelBg/panelSubBg) → surface.* へ内部移行予定
//  - fg*       : 前景テキスト/アイコン
//  - border*   : ボーダー階層 (default → strong → focus)
//  - accent*   : アクセント (オレンジ) の段階 (solid/subtle/fg)
//  - tone.*    : 成功/警告/危険/情報 系 (最小限; 旧値互換)

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

  // === FOREGROUND ===
  fgDefault: { value: "#F5F7FA" },
  fgMuted: { value: "rgba(245,247,250,0.65)" },
  fgSubtle: { value: "rgba(245,247,250,0.4)" },

  // === ACCENT (Orange) ===
  accent: { value: "{colors.orange.500}" },
  accentHover: { value: "{colors.orange.400}" },
  accentActive: { value: "{colors.orange.600}" },
  accentSubtle: { value: "rgba(255,122,26,0.12)" },
  accentRing: { value: "rgba(255,122,26,0.6)" },

  // === BORDERS ===
  borderDefault: { value: "rgba(255,255,255,0.08)" },
  borderStrong: { value: "rgba(255,255,255,0.16)" },
  borderAccent: { value: "rgba(255,122,26,0.6)" },

  // 旧互換 (削除予定) — gold themed leftovers -> accentに統合方向
  borderGold: { value: "rgba(255,180,80,0.55)" },
  woodBorder: { value: "rgba(255,180,80,0.25)" },

  // === STATE / FEEDBACK ===
  successSolid: { value: "green.500" },
  dangerSolid: { value: "red.500" },
  successSubtle: { value: "rgba(16,185,129,0.15)" },
  dangerSubtle: { value: "rgba(239,68,68,0.15)" },
  successBorder: { value: "rgba(16,185,129,0.6)" },
  dangerBorder: { value: "rgba(239,68,68,0.6)" },

  // === INTERACTION ===
  focusRing: { value: "{colors.orange.400}" },
  link: { value: "{colors.orange.400}" },
  cardHoverBg: { value: "#1E2026" },

  // === SPECIAL LEGACY ===
  panelBannerFg: { value: "#10141A" },
  selfNumberFg: { value: "#FF9A4A" },
};

// コントラスト参考 (fgDefault #F5F7FA vs surfaceBase #0C0D10):
//  L1 = (245+0.05)/255 ≒ 0.980 -> 正確には相対輝度計算必要だが概ね 18+:1 で WCAG AAA 達成。
//  accent (#FF7A1A) vs surfaceBase (#0C0D10) : 相対輝度概算 → AAA (計算例: Laccent≈0.37, Lbg≈0.01 -> (0.37+0.05)/(0.01+0.05)≈7.33:1)
