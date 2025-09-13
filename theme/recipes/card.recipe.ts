import { defineRecipe } from "@chakra-ui/react";

/**
 * DQ Card Recipe - HUMAN-LIKE UI/UX ガイドライン準拠
 * 設計原則:
 * - ピクセル風質感: blur禁止、段積み影でレトロ感
 * - レトロ角丸: sm=4px で統一
 * - 既定値禁止: tokens経由でのみスタイル適用
 * - 状態差強化: hover/active/selected の明確な視覚フィードバック
 * - 意味のあるアニメ: 180ms stateTransition
 */
export const cardRecipe = defineRecipe({
  className: "dq-card", // Dragon Quest Card
  base: {
    // === SURFACE - ガイドライン準拠 ===
    bg: "cardBg", // ink.800 + alpha
    color: "textPrimary", // obsidian.50 - 最大コントラスト
    borderRadius: "sm", // レトロ: 4px固定
    boxShadow: "card", // ピクセル風段積み影
    p: 6, // humanSpacing: 16px
    border: "1px solid",
    borderColor: "cardBorder", // slimeBlue @ 60%

    // === MOTION - ガイドライン準拠（意味中心） ===
    transition: "all 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)", // stateTransition
    willChange: "transform, box-shadow, border-color",
  },
  variants: {
    // === INTERACTION STATES ===
    interactive: {
      true: {
        cursor: "pointer",
        _hover: {
          borderColor: "accent", // slimeBlue.500
          boxShadow: "cardHover", // 段積み影強化
          transform: "translateY(-1px)", // ガイドライン準拠の浮き上がり
        },
        _active: {
          transform: "translateY(0)", // 押し込み
          boxShadow: "px1", // 影弱化
        },
      },
      false: {
        // ノンインタラクティブカードは静的
      },
    },

    // === DENSITY VARIANTS - tokens経由 ===
    density: {
      compact: {
        p: 4, // humanSpacing: 8px
      },
      comfortable: {
        p: 6, // humanSpacing: 16px (デフォルト)
      },
      spacious: {
        p: 8, // humanSpacing: 24px
      },
    },

    // === SELECTION STATE ===
    selected: {
      true: {
        borderColor: "accent", // slimeBlue.500
        bg: "accentSubtle", // slimeBlue @ 10%
        boxShadow: "cardHover", // 選択時は強化影
      },
      false: {
        // 通常状態
      },
    },

    // === VISUAL VARIANTS ===
    variant: {
      // === DEFAULT - 標準カード ===
      default: {
        // baseスタイルをそのまま使用
      },

      // === ELEVATED - 浮き上がり強調 ===
      elevated: {
        boxShadow: "lg", // より強い段積み影
        bg: "bgPanel", // obsidian.800 (より明るい背景)
      },

      // === OUTLINED - ボーダー強調 ===
      outlined: {
        bg: "transparent",
        borderColor: "borderStrong", // 24% 可視性
        boxShadow: "none",

        _hover: {
          borderColor: "accent",
          bg: "hoverOverlay", // 8% white overlay
          boxShadow: "sm", // 小さめ段積み影
        },
      },

      // === SUCCESS - 成功状態 ===
      success: {
        borderColor: "successBorder", // 成功色ボーダー
        bg: "successSubtle", // 成功色サトル背景
      },

      // === DANGER - エラー/警告状態 ===
      danger: {
        borderColor: "dangerBorder", // エラー色ボーダー
        bg: "dangerSubtle", // エラー色サトル背景
      },

      // === HIGHLIGHT - 特別強調（heroGold） ===
      highlight: {
        borderColor: "heroGold.400",
        bg: "rgba(217,180,74,0.1)", // heroGold @ 10%
      },
    },

    // === SIZE VARIANTS ===
    size: {
      sm: {
        p: 4, // humanSpacing: 8px
        borderRadius: "xs", // 2px - より小さなレトロ角丸
      },
      md: {
        p: 6, // humanSpacing: 16px (デフォルト)
        borderRadius: "sm", // 4px - 標準レトロ角丸
      },
      lg: {
        p: 8, // humanSpacing: 24px
        borderRadius: "md", // 6px - 大きめレトロ角丸
      },
    },
  },
  defaultVariants: {
    interactive: false,
    density: "comfortable",
    selected: false,
    variant: "default",
    size: "md",
  },
});

export default cardRecipe;