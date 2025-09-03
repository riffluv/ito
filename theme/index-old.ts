import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
// 新しいプレミアムゲームテーマのインポート
import { premiumTokens, premiumSemanticTokens } from "./premiumGameTheme";
// 分割された foundations / semantic token モジュール（後方互換性）
import { borderWidths, radii } from "./foundations/borders";
import { semanticColors } from "./semantic/colors";
import { semanticGradients } from "./semantic/gradients";
import { semanticShadows } from "./semantic/shadows";

// Premium Game Theme - Chakra UI Official Inspired
// 一流ゲームUI/UXデザイナーによる大人の洗練されたテーマ
// リッチブラック（マット加工）+ ティールセカンダリー（#14b8a6）
const config = defineConfig({
  preflight: true,
  // container queries & custom selectors
  conditions: {
    cqSm: "@container (min-width: 32rem)",
    cqMd: "@container (min-width: 48rem)",
    cqLg: "@container (min-width: 64rem)",
    hover: "@media (hover: hover)",
    reducedMotion: "@media (prefers-reduced-motion: reduce)",
  },
  strictTokens: false, // プレミアムテーマ導入のため一時的にfalse
  
  // グローバルスタイル - 洗練された大人のゲームUI
  globalCss: {
    "html, body": {
      bg: "richBlack.900",
      color: "rgba(255, 255, 255, 0.95)",
      fontFamily: "body",
      lineHeight: "normal",
      scrollBehavior: "smooth",
    },
    
    // プロフェッショナルなフォーカスリング
    ":focus-visible": {
      outline: "2px solid",
      outlineColor: "teal.500",
      outlineOffset: "3px",
      borderRadius: "sm",
    },
    
    // スクロールバーのカスタマイズ（WebKit）
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
  },
  
  theme: {
    // プレミアムトークンを基盤として使用
    tokens: {
      ...premiumTokens,
      
      // 既存トークンとの互換性維持
      borderWidths,
      
      breakpoints: {
        sm: { value: "30em" },   // 480px
        md: { value: "48em" },   // 768px  
        lg: { value: "62em" },   // 992px
        xl: { value: "80em" },   // 1280px
        "2xl": { value: "96em" }, // 1536px
      },
      
      fonts: {
        heading: {
          value: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Noto Sans JP', ui-sans-serif, system-ui, 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        },
        body: {
          value: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Noto Sans JP', ui-sans-serif, system-ui, 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        },
        mono: {
          value: "'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
        },
      },
    },
    
    // セマンティックトークン
    semanticTokens: premiumSemanticTokens,
      colors: {
        brand: {
          50: { value: "#E6FFFA" },
          100: { value: "#B2F5EA" },
          200: { value: "#81E6D9" },
          300: { value: "#4FD1C5" },
          400: { value: "#38B2AC" },
          500: { value: "#319795" },
          600: { value: "#2C7A7B" },
          700: { value: "#285E61" },
          800: { value: "#234E52" },
          900: { value: "#1D4044" },
        },
        orange: {
          50: { value: "#FFF5EC" },
          100: { value: "#FFE3CC" },
          200: { value: "#FFC7A1" },
          300: { value: "#FFAA75" },
          400: { value: "#FF8F3D" },
          500: { value: "#FF7A1A" },
          600: { value: "#E86A0C" },
          700: { value: "#BF5006" },
          800: { value: "#8F3B05" },
          900: { value: "#5F2703" },
        },
      },
      shadows: {
        xs: { value: "0 1px 2px rgba(0,0,0,0.12)" },
        sm: { value: "0 2px 4px -1px rgba(0,0,0,0.18)" },
        md: { value: "0 4px 10px -2px rgba(0,0,0,0.28)" },
        // Panel / Card 用の統一シャドウトークン
        panelSubtle: { value: "0 1px 2px 0 rgba(0,0,0,0.05)" },
        panelDistinct: {
          value: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)",
        },
        cardRaised: {
          value:
            "0 1px 3px -1px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.06)",
        },
        cardFloating: {
          value:
            "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
        },
        cardElevated: {
          value:
            "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
        },
        activeArea: { value: "inset 0 1px 2px 0 rgba(0,0,0,0.06)" },
        glow: {
          value:
            "0 0 0 2px rgba(56,178,172,0.55), 0 0 18px -4px rgba(56,178,172,0.5)",
        },
        glowDanger: {
          value:
            "0 0 0 2px rgba(255,80,80,0.7), 0 0 22px -4px rgba(255,80,80,0.6)",
        },
        selfNumber: { value: "0 15px 35px rgba(255,107,53,0.3)" },
      },
      animations: {
        fadeIn: { value: "fadeIn 180ms ease-out" },
        scaleIn: { value: "scaleIn 160ms ease-out" },
      },
      easings: {
        standard: { value: "cubic-bezier(.4,0,.2,1)" },
        emphasized: { value: "cubic-bezier(.2,0,.1,1)" },
      },
      durations: {
        fast: { value: "120ms" },
        normal: { value: "200ms" },
        slow: { value: "320ms" },
      },
      gradients: {
        accentSoft: { value: "linear(90deg,#ff9a58,#ffcf67)" },
        dangerStrong: {
          value: "linear(90deg,rgba(255,70,70,0.9),rgba(120,0,0,0.9))",
        },
        playerNumber: { value: "linear(145deg,#FF8A50,#FFD97A)" },
      },
      // spacing scale (Chakra v3 key: spacing)
      spacing: {
        0: { value: "0" },
        1: { value: "4px" },
        1.5: { value: "6px" },
        2: { value: "8px" },
        2.5: { value: "10px" },
        3: { value: "12px" },
        3.5: { value: "14px" },
        4: { value: "16px" },
        5: { value: "20px" },
        6: { value: "24px" },
        7: { value: "28px" },
        8: { value: "32px" },
        9: { value: "36px" },
        10: { value: "40px" },
        12: { value: "48px" },
        14: { value: "56px" },
        16: { value: "64px" },
        20: { value: "80px" },
        24: { value: "96px" },
        28: { value: "112px" },
        32: { value: "128px" },
        36: { value: "144px" },
        40: { value: "160px" },
        48: { value: "192px" },
        56: { value: "224px" },
        64: { value: "256px" },
        72: { value: "288px" },
        80: { value: "320px" },
        96: { value: "384px" },
      },
      sizes: {
        // === コンテナーサイズ ===
        containerSm: { value: "640px" },
        containerMd: { value: "768px" },
        containerLg: { value: "1024px" },

        // === ゲーム要素 - 2025年DPI対応コンテナクエリベース ===
        // カードサイズ: fluid + container query 対応
        cardMin: { value: "clamp(5rem, 6cqi, 7rem)" }, // 80px-112px
        cardIdeal: { value: "clamp(6rem, 9cqi, 8rem)" }, // 96px-128px
        cardMax: { value: "clamp(7.5rem, 13cqi, 10rem)" }, // 120px-160px (拡大)

        // レガシー互換性 (段階的移行用)
        cardW: { value: "clamp(6rem, 9cqi, 8rem)" }, // cardIdealと同値
        cardH: { value: "auto" }, // aspect-ratioで制御
        cardWBase: { value: "clamp(5rem, 6cqi, 6.5rem)" }, // モバイル用
        cardHBase: { value: "auto" }, // aspect-ratioで制御

        // レイアウトサイズ: UNIFIED_LAYOUTと統一
        headerHeight: { value: "clamp(80px, 8vh, 120px)" }, // UNIFIED_LAYOUT.HEADER_HEIGHT
        sidebarWidth: { value: "clamp(240px, 22vw, 300px)" }, // UNIFIED_LAYOUT.SIDEBAR_WIDTH
        rightPanelWidth: { value: "clamp(280px, 26vw, 360px)" }, // UNIFIED_LAYOUT.RIGHT_PANEL_WIDTH
        handAreaHeight: { value: "clamp(220px, 25vh, 280px)" }, // UNIFIED_LAYOUT.HAND_AREA_HEIGHT

        // === 3Dアニメーション用 ===
        // perspective token (3D flip 用) ※ px: モーション自然さ考慮し将来 fluid 化検討
        perspectiveCard: { value: "1200px" },
      },
    },
    semanticTokens: {
      colors: semanticColors,
      // カード関連 sizes (そのまま再利用)
      sizes: {
        "card.min": { value: "clamp(4.5rem, 5cqi, 6rem)" }, // 72px-96px
        "card.ideal": { value: "{sizes.cardIdeal}" },
        "card.max": { value: "clamp(8.5rem, 16cqi, 11rem)" }, // 136px-176px (拡大)
        "card.gap": { value: "clamp(0.25rem, 1cqi, 0.75rem)" }, // 4px-12px
        "card.padding": { value: "clamp(0.5rem, 2cqi, 1rem)" }, // 8px-16px
        "board.maxWidth": { value: "min(100%, 90rem)" }, // 1440px max
      },
      aspectRatios: {
        card: { value: "5 / 7" }, // トランプカード比率
      },
      shadows: semanticShadows,
      gradients: semanticGradients,
    },
    recipes: {
      button: {
        className: "app-btn",
        base: {
          fontWeight: "semibold",
          rounded: "md",
          transition: "all 0.2s ease",
          letterSpacing: "tight",
          lineHeight: 1.2,
          _focusVisible: {
            outline: "2px solid",
            outlineOffset: "2px",
          },
        },
        variants: {
          size: {
            sm: { px: 3, py: 2, fontSize: "sm", minW: "6.5rem" },
            md: { px: 4, py: 2.5, fontSize: "sm", minW: "8rem" },
            lg: { px: 5, py: 3, fontSize: "md", minW: "10rem" },
          },
          density: {
            compact: { py: 2 },
            comfortable: { py: 2.5 },
          },
          visual: {
            solid: { boxShadow: "xs" },
            outline: { boxShadow: "none", _hover: { boxShadow: "xs" } },
            ghost: { boxShadow: "none" },
            subtle: {
              bg: "accentSubtle",
              color: "accent",
              _hover: {
                bg: "{colors.brand.100}",
              },
              _active: {
                bg: "{colors.brand.200}",
              },
            },
            soft: {
              bg: "{colors.orange.50}",
              color: "{colors.orange.600}",
              shadow: "xs",
              _hover: {
                bg: "{colors.orange.100}",
                shadow: "sm",
              },
              _active: {
                bg: "{colors.orange.200}",
              },
            },
            link: {
              color: "link",
              px: 0,
              py: 0,
              rounded: "none",
              _hover: { textDecoration: "underline" },
            },
          },
          palette: {
            brand: { _focusVisible: { outlineColor: "{colors.brand.400}" } },
            orange: { _focusVisible: { outlineColor: "{colors.orange.400}" } },
            gray: { _focusVisible: { outlineColor: "{colors.gray.400}" } },
          },
        },
        // defaultVariants: { size: "md", density: "comfortable", visual: "solid", palette: "brand" },
      },
      card: {
        className: "app-card",
        base: {
          bg: "panelBg",
          color: "fgDefault",
          borderWidth: "1px",
          borderColor: "borderDefault",
          rounded: "lg",
          shadow: "xs",
          p: 6,
          transition:
            "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease",
        },
        variants: {
          interactive: {
            true: {
              _hover: {
                shadow: "sm",
                borderColor: "accent",
                bg: "cardHoverBg",
                transform: "translateY(-1px) scale(1.01)",
              },
            },
            false: {},
          },
          density: {
            compact: { p: 5 },
            comfortable: { p: 6 },
          },
          selected: {
            true: { borderColor: "accent", shadow: "md" },
            false: {},
          },
        },
        // defaultVariants: { interactive: false, density: "comfortable", selected: false },
      },
    },
    slotRecipes: {
      gameCard: {
        slots: ["container", "inner", "front", "back", "frame"],
        base: {
          container: {
            perspective: "1000px",
            position: "relative",
            // === 2025年 DPI対応サイズ ===
            aspectRatio: "var(--card-aspect)",
            width: "clamp(var(--card-min), var(--card-ideal), var(--card-max))",
            minWidth: "var(--card-min)",
            maxWidth: "var(--card-max)",
            height: "auto", // aspect-ratioが制御

            // Grid アイテムとしての最適化
            placeSelf: "start",
          },
          inner: {
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transition: "transform 800ms cubic-bezier(0.23, 1, 0.32, 1)",
            willChange: "transform",
            filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.3))",
            _focusVisible: {
              outline: "2px solid {colors.focusRing}",
              outlineOffset: "2px",
            },
          },
          front: {
            p: 4,
            rounded: "2xl",
            borderWidth: "2px",
            fontWeight: 700,
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            bg: "{colors.surfaceRaised}",
            borderColor: "{colors.borderStrong}",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
            _before: {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              bg: "linear-gradient(135deg, rgba(255,122,26,0.05) 0%, transparent 50%)",
              pointerEvents: "none"
            },
            _focusVisible: {
              outline: "2px solid {colors.focusRing}",
              outlineOffset: "2px",
            },
          },
          back: {
            p: 4,
            rounded: "2xl",
            borderWidth: "2px",
            fontWeight: 900,
            position: "absolute",
            inset: 0,
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            bg: "linear-gradient(135deg, {colors.accent} 0%, rgba(255,122,26,0.8) 100%)",
            borderColor: "{colors.accentRing}",
            color: "white",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(255,122,26,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            _before: {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              bg: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 70%)",
              pointerEvents: "none"
            },
            _focusVisible: {
              outline: "2px solid white",
              outlineOffset: "2px",
            },
          },
          frame: {
            p: 3,
            // === 2025年 DPI対応フレーム ===
            aspectRatio: "var(--card-aspect)",
            width: "clamp(var(--card-min), var(--card-ideal), var(--card-max))",
            minWidth: "var(--card-min)",
            maxWidth: "var(--card-max)",
            height: "auto", // aspect-ratioが制御

            rounded: "lg",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",

            // Grid アイテムとしての最適化
            placeSelf: "start",

            _focusVisible: {
              outline: "2px solid {colors.focusRing}",
              outlineOffset: "2px",
            },
          },
        },
        variants: {
          variant: {
            flip: {},
            flat: {},
          },
          state: {
            default: {},
            success: {},
            fail: {},
          },
        },
        compoundVariants: [
          // 新シンプルスタイル: flip variant 背面/前面を同一 surfaceRaised ベース + state 枠色のみ変更
          {
            variant: "flip",
            state: "default",
            css: {
              front: {
                bg: "surfaceRaised",
                borderColor: "borderDefault",
                color: "fgDefault",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              },
              back: {
                bg: "surfaceRaised",
                borderColor: "borderDefault",
                color: "fgDefault",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              },
            },
          },
          {
            variant: "flip",
            state: "success",
            css: {
              front: { borderColor: "successBorder", bg: "successSubtle" },
              back: { borderColor: "successBorder", bg: "successSubtle" },
            },
          },
          {
            variant: "flip",
            state: "fail",
            css: {
              front: { borderColor: "dangerBorder", bg: "dangerSubtle" },
              back: { borderColor: "dangerBorder", bg: "dangerSubtle" },
            },
          },
          {
            variant: "flat",
            state: "default",
            css: {
              frame: {
                bg: "surfaceRaised",
                borderColor: "borderDefault",
                color: "fgDefault",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              },
            },
          },
          {
            variant: "flat",
            state: "success",
            css: {
              frame: { borderColor: "successBorder", bg: "successSubtle" },
            },
          },
          {
            variant: "flat",
            state: "fail",
            css: { frame: { borderColor: "dangerBorder", bg: "dangerSubtle" } },
          },
        ],
      },
      panel: {
        // Panel コンポーネント用 slot recipe (Header/Body/Actions/Footer)
        slots: ["container", "header", "title", "actions", "body", "footer"],
        base: {
          container: {
            bg: "panelBg",
            color: "fgDefault",
            borderWidth: "1px",
            borderColor: "borderDefault",
            rounded: "xl",
            shadow: "xs",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          },
          header: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 4,
            mb: 4,
            minH: "2rem",
          },
          title: { fontWeight: 600, fontSize: "sm", lineHeight: 1.3 },
          actions: { display: "flex", alignItems: "center", gap: 2 },
          body: { flex: 1 },
          footer: {
            mt: 4,
            pt: 3,
            borderTopWidth: "1px",
            borderColor: "borderDefault",
          },
        },
        variants: {
          density: {
            comfortable: { container: { p: 6 }, header: { mb: 5 } },
            compact: { container: { p: 4 }, header: { mb: 3 } },
          },
          variant: {
            surface: {},
            subtle: {
              container: {
                bg: "panelSubBg",
              },
            },
            outlined: {
              container: {
                bg: "transparent",
                borderColor: "{colors.gray.300}",
              },
            },
            accent: {
              container: {
                bg: "accentSubtle",
                borderColor: "accent",
              },
              title: { color: "accent" },
            },
          },
          elevated: {
            true: { container: { shadow: "md" } },
            false: {},
          },
        },
        compoundVariants: [
          {
            variant: "accent",
            elevated: true,
            css: {
              container: { shadow: "glow" },
            },
          },
        ],
      },
    },
    // v3では layerStyles/textStyles は recipes/slot recipes 推奨だが、
    // ここでは tokens/semanticTokens をメインに定義
  },
});

export const system = createSystem(defaultConfig, config);

export default system;
// 高DPI / メディアクエリ指針:
// - 画像は image-set() を利用しデバイスピクセル密度に応じた最適画像を配信。
// - 高精細向け微調整例: sx={{ '@media (min-resolution: 2dppx)': { shadow: 'md' } }}
