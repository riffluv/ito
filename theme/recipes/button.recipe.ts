import { defineRecipe } from "@chakra-ui/react";

/**
 * DQ Button Recipe - HUMAN-LIKE UI/UX ガイドライン準拠
 * 設計原則:
 * - 既定値禁止: すべてtokens経由でスタイル適用
 * - ピクセル風質感: blur最小、段積み影でレトロ感
 * - レトロ角丸: xs=2, sm=4, md=6, lg=8 で統一
 * - 状態差強化: hover/active/disabled の明確なフィードバック
 * - 意味のあるアニメ: 120-240ms中心、中断可能
 */
export const buttonRecipe = defineRecipe({
  className: "dq-btn", // Dragon Quest Button
  base: {
    // === TYPOGRAPHY - ガイドライン準拠 ===
    fontWeight: "bold", // tokens経由
    fontFamily: "heading", // DQ風フォント
    letterSpacing: "normal", // 既定値なし
    lineHeight: "normal", // tokens経由
    textTransform: "none",

    // === LAYOUT - tokens経由のみ ===
    borderRadius: "sm", // レトロ: 4px固定
    border: "1px solid", // ピクセル風: 細めボーダー
    cursor: "pointer",
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    userSelect: "none",

    // === MOTION - ガイドライン準拠（意味中心）===
    transition: "all 120ms cubic-bezier(0, 0, 0.3, 1)", // microFeedback
    willChange: "transform, box-shadow",

    // === ACCESSIBILITY - WCAG AAA準拠 ===
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "focusRing", // slimeBlue.500 @ 80% opacity
      outlineOffset: "2px",
      boxShadow: "0 0 0 4px rgba(58,176,255,0.15)", // accentRing弱め
    },
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
      transform: "none !important",
      boxShadow: "none !important",
    },

    // === INTERACTION - 状態差強化 ===
    _active: {
      transform: "translateY(0)", // 押し込み (ガイドライン準拠)
      boxShadow: "px1", // 影弱化
    },
  },
  variants: {
    size: {
      // === SIZE SYSTEM - tokens経由のみ ===
      xs: {
        px: 3, // humanSpacing: 6px
        py: 2, // humanSpacing: 4px
        fontSize: "xs", // tokens: 12px
        minW: "auto",
        height: "auto", // 自動高さ
        gap: 2, // humanSpacing: 4px
      },
      sm: {
        px: 4, // humanSpacing: 8px
        py: 2, // humanSpacing: 4px
        fontSize: "sm", // tokens: 14px
        minW: "auto",
        height: "auto",
        gap: 2, // humanSpacing: 4px
      },
      md: {
        px: 5, // humanSpacing: 12px
        py: 3, // humanSpacing: 6px
        fontSize: "md", // tokens: 16px
        minW: "auto",
        height: "auto",
        gap: 3, // humanSpacing: 6px
      },
      lg: {
        px: 6, // humanSpacing: 16px
        py: 4, // humanSpacing: 8px
        fontSize: "lg", // tokens: 18px
        minW: "auto",
        height: "auto",
        gap: 3, // humanSpacing: 6px
      },
      xl: {
        px: 8, // humanSpacing: 24px
        py: 5, // humanSpacing: 12px
        fontSize: "xl", // tokens: 20px
        minW: "auto",
        height: "auto",
        gap: 4, // humanSpacing: 8px
      },
    },

    variant: {
      // === DQ VARIANT - ガイドライン準拠 ===
      dq: {
        bg: "bgPanel", // obsidian.800 - パネル背景と統一
        color: "textPrimary", // obsidian.50 - 最大コントラスト
        borderColor: "borderStrong", // 24% 可視性
        boxShadow: "px2", // 段積み影 (ピクセル風)

        // === 状態差強化 ===
        _hover: {
          transform: "translateY(-1px)", // 浮き上がり
          bg: "rgba(20,23,34,0.94)", // ink.800 微変化
          boxShadow: "lg", // 影強化 (段積み)
        },

        _active: {
          transform: "translateY(0)", // 押し込み
          boxShadow: "px1", // 影弱化
        },
      },

      // === SOLID VARIANT - slimeBlue ベース ===
      solid: {
        bg: "accent", // slimeBlue.500
        color: "white", // 最大コントラスト
        borderColor: "accentActive", // slimeBlue.600
        boxShadow: "px2", // 段積み影

        _hover: {
          bg: "accentHover", // slimeBlue.400
          transform: "translateY(-1px)", // 浮き上がり
          boxShadow: "lg", // 影強化
        },

        _active: {
          bg: "accentActive", // slimeBlue.600
          transform: "translateY(0)", // 押し込み
          boxShadow: "px1", // 影弱化
        },
      },

      // === OUTLINE VARIANT - ボーダー強調 ===
      outline: {
        bg: "transparent",
        color: "accent", // slimeBlue.500
        borderColor: "accent", // slimeBlue.500
        boxShadow: "none",

        _hover: {
          bg: "accentSubtle", // slimeBlue @ 10%
          borderColor: "accentHover", // slimeBlue.400
          transform: "translateY(-1px)",
          boxShadow: "sm", // 小さめ段積み影
        },

        _active: {
          bg: "rgba(58,176,255,0.15)", // より濃い背景
          transform: "translateY(0)",
          boxShadow: "none",
        },
      },

      // === GHOST VARIANT - 最小限 ===
      ghost: {
        bg: "transparent",
        color: "textMuted", // obsidian.300
        borderColor: "transparent",
        boxShadow: "none",

        _hover: {
          color: "textPrimary", // obsidian.50
          bg: "hoverOverlay", // 8% white overlay
          borderColor: "borderDefault", // 12% white
          transform: "translateY(-1px)",
        },

        _active: {
          bg: "activeOverlay", // 12% white overlay
          transform: "translateY(0)",
        },
      },

      // === DANGER VARIANT - berryRed ===
      danger: {
        bg: "danger", // berryRed.400
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

      // === SUCCESS VARIANT - 成功時 ===
      success: {
        bg: "successSolid", // success.500
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

      // === HIGHLIGHT VARIANT - heroGold ===
      highlight: {
        bg: "highlight", // heroGold.400
        color: "obsidian.900", // 暗いテキストで高コントラスト
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