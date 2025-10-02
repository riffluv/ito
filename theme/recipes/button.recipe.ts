import { defineRecipe } from "@chakra-ui/react";

// DQボタン - ドラクエ風のレトロな質感
// blur禁止、段積み影でピクセル風にする
// アニメは120-240msくらいでサクサク動かす
export const buttonRecipe = defineRecipe({
  className: "dq-btn", // Dragon Quest Button
  base: {
    // フォント設定
    fontWeight: "bold",
    fontFamily: "heading",
    letterSpacing: "normal",
    lineHeight: "normal",
    textTransform: "none",

    // レイアウト
    borderRadius: "sm", // 4px固定でレトロ感
    border: "1px solid",
    cursor: "pointer",
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    userSelect: "none",

    // アニメーション
    transition: "all 120ms cubic-bezier(0, 0, 0.3, 1)",
    willChange: "transform, box-shadow",

    // フォーカス時のリング
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "focusRing",
      outlineOffset: "2px",
      boxShadow: "0 0 0 4px rgba(58,176,255,0.15)",
    },
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
      transform: "none !important",
      boxShadow: "none !important",
    },

    // クリック時の押し込み
    _active: {
      transform: "translateY(0)",
      boxShadow: "px1",
    },
  },
  variants: {
    size: {
      // サイズバリエーション
      xs: {
        px: 3,
        py: 2,
        fontSize: "xs",
        minW: "auto",
        height: "auto",
        gap: 2,
      },
      sm: {
        px: 4,
        py: 2,
        fontSize: "sm",
        minW: "auto",
        height: "auto",
        gap: 2,
      },
      md: {
        px: 5,
        py: 3,
        fontSize: "md",
        minW: "auto",
        height: "auto",
        gap: 3,
      },
      lg: {
        px: 6,
        py: 4,
        fontSize: "lg",
        minW: "auto",
        height: "auto",
        gap: 3,
      },
      xl: {
        px: 8,
        py: 5,
        fontSize: "xl",
        minW: "auto",
        height: "auto",
        gap: 4,
      },
    },

    variant: {
      // DQボタン（デフォルト）
      dq: {
        bg: "bgPanel",
        color: "textPrimary",
        borderColor: "borderStrong",
        boxShadow: "px2",

        _hover: {
          transform: "translateY(-1px)",
          bg: "rgba(20,23,34,0.94)",
          boxShadow: "lg",
        },

        _active: {
          transform: "translateY(0)",
          boxShadow: "px1",
        },
      },

      // ソリッド（青ボタン）
      solid: {
        bg: "accent",
        color: "white",
        borderColor: "accentActive",
        boxShadow: "px2",

        _hover: {
          bg: "accentHover",
          transform: "translateY(-1px)",
          boxShadow: "lg",
        },

        _active: {
          bg: "accentActive",
          transform: "translateY(0)",
          boxShadow: "px1",
        },
      },

      // アウトライン（枠線強調）
      outline: {
        bg: "transparent",
        color: "accent",
        borderColor: "accent",
        boxShadow: "none",

        _hover: {
          bg: "accentSubtle",
          borderColor: "accentHover",
          transform: "translateY(-1px)",
          boxShadow: "sm",
        },

        _active: {
          bg: "rgba(58,176,255,0.15)",
          transform: "translateY(0)",
          boxShadow: "none",
        },
      },

      // ゴースト（透明ボタン）
      ghost: {
        bg: "transparent",
        color: "textMuted",
        borderColor: "transparent",
        boxShadow: "none",

        _hover: {
          color: "textPrimary",
          bg: "hoverOverlay",
          borderColor: "borderDefault",
          transform: "translateY(-1px)",
        },

        _active: {
          bg: "activeOverlay",
          transform: "translateY(0)",
        },
      },

      // 危険（赤ボタン）
      danger: {
        bg: "danger",
        color: "white",
        borderColor: "berryRed.500",
        boxShadow: "px2",

        _hover: {
          bg: "berryRed.300",
          transform: "translateY(-1px)",
          boxShadow: "lg",
        },

        _active: {
          bg: "berryRed.500",
          transform: "translateY(0)",
          boxShadow: "px1",
        },
      },

      // 成功（緑ボタン）
      success: {
        bg: "successSolid",
        color: "white",
        borderColor: "success.600",
        boxShadow: "px2",

        _hover: {
          bg: "success.400",
          transform: "translateY(-1px)",
          boxShadow: "lg",
        },

        _active: {
          bg: "success.600",
          transform: "translateY(0)",
          boxShadow: "px1",
        },
      },

      // ハイライト（金色ボタン）
      highlight: {
        bg: "highlight",
        color: "obsidian.900",
        borderColor: "heroGold.500",
        boxShadow: "px2",

        _hover: {
          bg: "heroGold.300",
          transform: "translateY(-1px)",
          boxShadow: "lg",
        },

        _active: {
          bg: "heroGold.500",
          transform: "translateY(0)",
          boxShadow: "px1",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
    variant: "dq", // デフォルトはDQ風
  },
});

export default buttonRecipe;