import { defineRecipe } from "@chakra-ui/react";

// DQカード - ピクセル風のレトロな質感
// blur禁止、段積み影でドラクエ感出す
// アニメは180msくらいでサクッと動かす
export const cardRecipe = defineRecipe({
  className: "dq-card", // Dragon Quest Card
  base: {
    // 基本スタイル
    bg: "cardBg",
    color: "textPrimary",
    borderRadius: "sm", // 4px固定でレトロ感
    boxShadow: "card",
    p: 6,
    border: "1px solid",
    borderColor: "cardBorder",

    // アニメーション
    transition: "all 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    willChange: "transform, box-shadow, border-color",
  },
  variants: {
    // インタラクティブかどうか
    interactive: {
      true: {
        cursor: "pointer",
        _hover: {
          borderColor: "accent",
          boxShadow: "cardHover",
          transform: "translateY(-1px)",
        },
        _active: {
          transform: "translateY(0)",
          boxShadow: "px1",
        },
      },
      false: {},
    },

    // 余白の密度
    density: {
      compact: {
        p: 4,
      },
      comfortable: {
        p: 6,
      },
      spacious: {
        p: 8,
      },
    },

    // 選択状態
    selected: {
      true: {
        borderColor: "accent",
        bg: "accentSubtle",
        boxShadow: "cardHover",
      },
      false: {},
    },

    // 見た目のバリエーション
    variant: {
      // デフォルト
      default: {},

      // 浮き上がり強調
      elevated: {
        boxShadow: "lg",
        bg: "bgPanel",
      },

      // ボーダー強調
      outlined: {
        bg: "transparent",
        borderColor: "borderStrong",
        boxShadow: "none",

        _hover: {
          borderColor: "accent",
          bg: "hoverOverlay",
          boxShadow: "sm",
        },
      },

      // 成功
      success: {
        borderColor: "successBorder",
        bg: "successSubtle",
      },

      // 危険
      danger: {
        borderColor: "dangerBorder",
        bg: "dangerSubtle",
      },

      // ハイライト（金色）
      highlight: {
        borderColor: "heroGold.400",
        bg: "rgba(217,180,74,0.1)",
      },
    },

    // サイズバリエーション
    size: {
      sm: {
        p: 4,
        borderRadius: "xs",
      },
      md: {
        p: 6,
        borderRadius: "sm",
      },
      lg: {
        p: 8,
        borderRadius: "md",
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