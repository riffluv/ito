import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { premiumSemanticTokens, premiumTokens } from "./premiumGameTheme";
import { buttonRecipe } from "./recipes/button.recipe";

/**
 * Premium Game Theme System - Chakra UI Official Inspired
 * 一流ゲームUI/UXデザイナーによる洗練されたテーマ
 * リッチブラック（マット加工）+ ティールセカンダリー（#14b8a6）
 *
 * 設計思想:
 * - AIっぽさを排除した人間的な細部へのこだわり
 * - 長時間プレイでも疲れない品格のあるデザイン
 * - Chakra UI公式のような洗練された美的バランス
 * - プロフェッショナルゲームUI/UX基準
 */

const config = defineConfig({
  preflight: true,

  // コンテナクエリ & カスタムセレクター
  conditions: {
    cqSm: "@container (min-width: 32rem)",
    cqMd: "@container (min-width: 48rem)",
    cqLg: "@container (min-width: 64rem)",
    // hover: "@media (hover: hover)", // ← コメントアウト: ホバー機能を常に有効化
    reducedMotion: "@media (prefers-reduced-motion: reduce)",
  },

  strictTokens: false, // プレミアムテーマ導入のため柔軟に

  // プロフェッショナルなグローバルスタイル
  globalCss: {
    "html, body": {
      bg: "richBlack.900",
      color: "rgba(255, 255, 255, 0.95)",
      fontFamily: "body",
      lineHeight: "normal",
      scrollBehavior: "smooth",
    },

    // 洗練されたフォーカスリング
    ":focus-visible": {
      outline: "2px solid",
      outlineColor: "teal.500",
      outlineOffset: "3px",
      borderRadius: "sm",
    },

    // 美しいスクロールバー
    "::-webkit-scrollbar": {
      width: "8px",
      height: "8px",
    },
    "::-webkit-scrollbar-track": {
      bg: "richBlack.800",
    },
    "::-webkit-scrollbar-thumb": {
      bg: "rgba(20, 184, 166, 0.3)",
      borderRadius: "full",
    },
    "::-webkit-scrollbar-thumb:hover": {
      bg: "rgba(20, 184, 166, 0.5)",
    },

    // 数字表示の4ch制限を詳細度で上書き
    "div[class*='css-'] div[class*='css-'] [class*='css-1rr3l0b']": {
      width: "100%",
      minWidth: "0",
      maxWidth: "none",
      fontVariantNumeric: "normal",
      fontFamily: "inherit"
    },
  },

  theme: {
    // プレミアムトークンシステム + ドラクエ風ボーダー
    tokens: {
      ...premiumTokens,
      borders: {
        retrogame: { value: "3px solid white" }, // ドラクエ風統一ボーダー（メインメニュー用）
        retrogameInput: { value: "2px solid black" }, // 入力フィールド用
        retrogameThin: { value: "2px solid white" }, // 細めの区切り線用
        retrogameGame: { value: "1px solid white" }, // ゲーム内細かいUI用
        retrogameAccent: { value: "2px solid #6366F1" }, // アクセント用
        retrogameBevel: { value: "1px solid rgba(255,255,255,0.3)" }, // ベベル効果用
      },
    },

    // セマンティックトークン
    semanticTokens: premiumSemanticTokens,

    // コンポーネントレシピ - プロフェッショナルなスタイリング
    recipes: {
      // Global App Button recipe (DQ風ベベル、中強度)
      appButton: buttonRecipe,
      // ゲームカード用レシピ
      gameCard: {
        className: "game-card",
        base: {
          bg: "cardBg",
          border: "1.5px solid",
          borderColor: "cardBorder",
          borderRadius: "xl",
          boxShadow: "card",
          transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          cursor: "pointer",
        },
        variants: {
          size: {
            sm: {
              p: 3,
              minH: "80px",
            },
            md: {
              p: 4,
              minH: "100px",
            },
            lg: {
              p: 6,
              minH: "120px",
            },
          },
          state: {
            default: {
              borderColor: "cardBorder",
            },
            hover: {
              borderColor: "primary",
              boxShadow: "cardHover",
              transform: "translateY(-2px)",
            },
            active: {
              transform: "translateY(0) scale(0.98)",
            },
            selected: {
              borderColor: "primary",
              bg: "primarySubtle",
              boxShadow: "cardHover",
            },
          },
        },
        defaultVariants: {
          colorPalette: "teal",
        },
      },

      // ゲームパネル用レシピ
      gamePanel: {
        className: "game-panel",
        base: {
          bg: "bgSubtle",
          border: "1px solid",
          borderColor: "border",
          borderRadius: "2xl",
          boxShadow: "panel",
          backdropFilter: "blur(20px)",
          p: 6,
        },
        variants: {
          variant: {
            default: {
              bg: "bgSubtle",
            },
            elevated: {
              bg: "bgMuted",
              boxShadow: "xl",
            },
            glass: {
              bg: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(40px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            },
          },
        },
        defaultVariants: {
          colorPalette: "teal",
        },
      },

      // プライマリーボタン用レシピ
      primaryButton: {
        className: "primary-button",
        base: {
          bg: "primary",
          color: "white",
          borderRadius: "lg",
          fontWeight: "semibold",
          transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          cursor: "pointer",
          border: "none",
          outline: "none",
          _focusVisible: {
            boxShadow: "0 0 0 3px rgba(20, 184, 166, 0.3)",
          },
        },
        variants: {
          size: {
            sm: {
              px: 3,
              py: 2,
              fontSize: "sm",
              h: "32px",
            },
            md: {
              px: 4,
              py: 2.5,
              fontSize: "md",
              h: "40px",
            },
            lg: {
              px: 6,
              py: 3,
              fontSize: "lg",
              h: "48px",
            },
          },
          variant: {
            solid: {
              bg: "primary",
              _hover: {
                bg: "teal.600",
                transform: "translateY(-1px)",
                boxShadow: "lg",
              },
              _active: {
                transform: "translateY(0) scale(0.98)",
              },
            },
            outline: {
              bg: "transparent",
              border: "2px solid",
              borderColor: "primary",
              color: "primary",
              _hover: {
                bg: "primarySubtle",
                borderColor: "teal.600",
              },
            },
            ghost: {
              bg: "transparent",
              color: "primary",
              _hover: {
                bg: "primarySubtle",
              },
            },
          },
        },
        defaultVariants: {
          colorPalette: "teal",
        },
      },
    },
  },
});

// システム作成
export const system = createSystem(defaultConfig, config);
export default system;

// 型安全性のためのヘルパー
export type GameCardVariants = {
  size?: "sm" | "md" | "lg";
  state?: "default" | "hover" | "active" | "selected";
};

export type GamePanelVariants = {
  variant?: "default" | "elevated" | "glass";
};

export type PrimaryButtonVariants = {
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "outline" | "ghost";
};
