import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { premiumSemanticTokens, premiumTokens } from "./premiumGameTheme";
import { buttonRecipe } from "./recipes/button.recipe";
import { cardRecipe } from "./recipes/card.recipe";

/**
 * Dragon Quest Game Theme System - HUMAN-LIKE UI/UX ガイドライン完全準拠
 * obsidian.900 + slimeBlue.500 + heroGold.400 + ピクセル風質感
 *
 * 設計思想:
 * - AIっぽさ完全排除: 既定値依存禁止、意図的なピクセル単位調整
 * - レトロ×現代: ドット質感 + WCAG AAA準拠
 * - ピクセル風影: blur最小、1-2px段積みで輪郭を立てる
 * - リズム感余白: 2,4,6,8,12,16,20,24 の人間的配列
 * - 意味のあるモーション: 120-240ms中心、中断可能
 */

const config = defineConfig({
  preflight: true,

  // コンテナクエリ & アクセシビリティ条件
  conditions: {
    cqSm: "@container (min-width: 32rem)",
    cqMd: "@container (min-width: 48rem)",
    cqLg: "@container (min-width: 64rem)",
    // hover: "@media (hover: hover)", // ← コメントアウト: ホバー機能を常に有効化
    reducedMotion: "@media (prefers-reduced-motion: reduce)", // ガイドライン準拠
  },

  strictTokens: true, // ガイドライン準拠: 直書き禁止、tokensのみ許可

  // ガイドライン準拠グローバルスタイル
  globalCss: {
    "html, body": {
      bg: "bgCanvas", // obsidian.900 - ガイドライン準拠
      color: "textPrimary", // obsidian.50 - 最大コントラスト
      fontFamily: "body",
      lineHeight: "normal", // tokens経由
      scrollBehavior: "smooth",
    },

    // アクセシブルフォーカスリング - ガイドライン準拠
    ":focus-visible": {
      outline: "2px solid",
      outlineColor: "focusRing", // slimeBlue @ 80% - 高可視
      outlineOffset: "2px", // tokens経由: 4px
      borderRadius: "xs", // レトロ: 2px
    },

    // Reduced Motion 対応 - ガイドライン準拠
    "html[data-prefers-reduced-motion]": {
      animationDuration: "0.01ms !important",
      animationIterationCount: "1 !important",
      transitionDuration: "0.01ms !important",
    },

    // DQ風スクロールバー - ガイドライン準拠
    "::-webkit-scrollbar": {
      width: "4px", // 細めのピクセル風
      height: "4px",
    },
    "::-webkit-scrollbar-track": {
      bg: "bgPanel", // obsidian.800
    },
    "::-webkit-scrollbar-thumb": {
      bg: "accent", // slimeBlue.500
      borderRadius: "none", // ピクセル風: 角丸なし
    },
    "::-webkit-scrollbar-thumb:hover": {
      bg: "accentHover", // slimeBlue.400
    },

    // 数字表示の4ch制限を詳細度で上書き
    ".dq-numeric-fix": {
      width: "100%",
      minWidth: "0",
      maxWidth: "none",
      fontVariantNumeric: "normal",
      fontFamily: "mono", // DQ風: 等幅フォント
    },
  },

  theme: {
    // ガイドライン準拠トークンシステム + DQ風ボーダー
    tokens: {
      ...premiumTokens,
      borders: {
        retrogame: { value: "3px solid" }, // DQ風統一ボーダー(メインメニュー用)
        retrogameInput: { value: "2px solid" }, // 入力フィールド用
        retrogameThin: { value: "2px solid" }, // 細めの区切り線用
        retrogameGame: { value: "1px solid" }, // ゲーム内細かいUI用
        retrogameAccent: { value: "2px solid" }, // アクセント用
        retrogameBevel: { value: "1px solid" }, // ベベル効果用
      },
    },

    // セマンティックトークン
    semanticTokens: premiumSemanticTokens,

    // ガイドライン準拠コンポーネントレシピ
    recipes: {
      // DQ Button Recipe - ガイドライン準拠完全版
      appButton: buttonRecipe,
      // DQ Card Recipe - ピクセル風質感
      appCard: cardRecipe,
      // DQゲームカード - ガイドライン準拠版
      gameCard: {
        className: "dq-game-card",
        base: {
          bg: "cardBg", // ink.800 + alpha
          border: "1px solid", // ピクセル風: 細めボーダー
          borderColor: "cardBorder", // slimeBlue @ 60%
          borderRadius: "sm", // レトロ: 4px固定
          boxShadow: "card", // ピクセル風段積み影
          transition: "all 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)", // stateTransition
          cursor: "pointer",
        },
        variants: {
          size: {
            sm: {
              p: 3, // humanSpacing: 6px
              minH: "60px", // コンパクト
            },
            md: {
              p: 4, // humanSpacing: 8px
              minH: "80px", // 標準
            },
            lg: {
              p: 6, // humanSpacing: 16px
              minH: "100px", // 大きめ
            },
          },
          state: {
            default: {
              borderColor: "cardBorder", // slimeBlue @ 60%
            },
            hover: {
              borderColor: "accent", // slimeBlue.500
              boxShadow: "cardHover", // 段積み影強化
              transform: "translateY(-1px)", // ガイドライン準拠の浮き上がり
            },
            active: {
              transform: "translateY(0)", // 押し込み
              boxShadow: "px1", // 影弱化
            },
            selected: {
              borderColor: "accent", // slimeBlue.500
              bg: "accentSubtle", // slimeBlue @ 10%
              boxShadow: "cardHover", // 選択時強化影
            },
          },
        },
        defaultVariants: {
          colorPalette: "blue", // Chakra standard palette
        },
      },

      // DQゲームパネル - ガイドライン準拠版
      gamePanel: {
        className: "dq-game-panel",
        base: {
          bg: "bgPanel", // obsidian.800
          border: "1px solid",
          borderColor: "borderDefault", // 12% 可視性
          borderRadius: "md", // レトロ: 6px
          boxShadow: "panel", // ピクセル風パネル影
          // backdropFilter 削除: ピクセル風に不適合
          p: 6, // humanSpacing: 16px
        },
        variants: {
          variant: {
            default: {
              bg: "bgPanel", // obsidian.800
            },
            elevated: {
              bg: "bgSubtle", // obsidian.700
              boxShadow: "lg", // 段積み影強化
            },
            subtle: {
              bg: "transparent",
              borderColor: "borderSubtle", // 6% 極薄
              boxShadow: "none",
            },
          },
        },
        defaultVariants: {
          colorPalette: "blue", // Chakra standard palette
        },
      },

      // DQプライマリーボタン - ガイドライン準拠版 (レシピで実装済み)
      primaryButton: {
        className: "dq-primary-button",
        base: {
          bg: "accent", // slimeBlue.500
          color: "white",
          borderRadius: "sm", // レトロ: 4px
          fontWeight: "bold", // DQ風
          border: "1px solid",
          borderColor: "accentActive", // slimeBlue.600
          boxShadow: "px2", // ピクセル風段積み影
          transition: "all 120ms cubic-bezier(0, 0, 0.3, 1)", // microFeedback
          cursor: "pointer",
          outline: "none",
          _focusVisible: {
            outline: "2px solid",
            outlineColor: "focusRing", // slimeBlue @ 80%
            outlineOffset: "2px",
          },
        },
        variants: {
          size: {
            sm: {
              px: 4, // humanSpacing: 8px
              py: 2, // humanSpacing: 4px
              fontSize: "sm", // tokens: 14px
              height: "auto", // 自動高さ
            },
            md: {
              px: 5, // humanSpacing: 12px
              py: 3, // humanSpacing: 6px
              fontSize: "md", // tokens: 16px
              height: "auto",
            },
            lg: {
              px: 6, // humanSpacing: 16px
              py: 4, // humanSpacing: 8px
              fontSize: "lg", // tokens: 18px
              height: "auto",
            },
          },
          variant: {
            solid: {
              bg: "accent", // slimeBlue.500
              _hover: {
                bg: "accentHover", // slimeBlue.400
                transform: "translateY(-1px)", // 浮き上がり
                boxShadow: "lg", // 段積み影強化
              },
              _active: {
                bg: "accentActive", // slimeBlue.600
                transform: "translateY(0)", // 押し込み
                boxShadow: "px1", // 影弱化
              },
            },
            outline: {
              bg: "transparent",
              border: "1px solid",
              borderColor: "accent", // slimeBlue.500
              color: "accent",
              boxShadow: "none",
              _hover: {
                bg: "accentSubtle", // slimeBlue @ 10%
                borderColor: "accentHover",
              },
            },
            ghost: {
              bg: "transparent",
              color: "accent", // slimeBlue.500
              border: "none",
              boxShadow: "none",
              _hover: {
                bg: "accentSubtle", // slimeBlue @ 10%
              },
            },
          },
        },
        defaultVariants: {
          colorPalette: "blue", // Chakra standard palette
        },
      },
    },
  },
});

// === システム作成 - ガイドライン準拠 ===

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
