import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

// Chakra UI v3: System ベース設定 (defineConfig 形式) + 2025 CSS 設計拡張
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
  strictTokens: true, // 型生成完了後 true に昇格
  theme: {
    tokens: {
      breakpoints: {
        sm: { value: "30em" },
        md: { value: "48em" },
        lg: { value: "62em" },
        xl: { value: "80em" },
        "2xl": { value: "96em" },
      },
      fonts: {
        heading: {
          value:
            "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        },
        body: {
          value:
            "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        },
      },
      fontSizes: {
        // fluid typography: clamp(min, vw-based, max)
        xs: { value: "clamp(0.72rem, 0.68rem + 0.2vw, 0.78rem)" },
        sm: { value: "clamp(0.8rem, 0.76rem + 0.25vw, 0.9rem)" },
        md: { value: "clamp(0.94rem, 0.88rem + 0.35vw, 1.05rem)" },
        lg: { value: "clamp(1.05rem, 0.98rem + 0.4vw, 1.25rem)" },
        xl: { value: "clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)" },
        "2xl": { value: "clamp(1.5rem, 1.35rem + 0.9vw, 1.9rem)" },
        "3xl": { value: "clamp(1.85rem, 1.6rem + 1.2vw, 2.4rem)" },
        "4xl": { value: "clamp(2.25rem, 2rem + 1.8vw, 3rem)" },
      },
      radii: {
        // シャープで現代的なトーン（Chakra公式に近い 4/8/12/16 ステップ）
        xs: { value: "4px" },
        sm: { value: "6px" },
        md: { value: "8px" },
        lg: { value: "12px" },
        xl: { value: "16px" },
        full: { value: "9999px" },
      },
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
    },
    semanticTokens: {
      colors: {
        canvasBg: { value: { base: "gray.50", _dark: "#0B0D10" } },
        panelBg: { value: { base: "white", _dark: "#11151A" } },
        panelSubBg: { value: { base: "gray.50", _dark: "#161A20" } },
        fgDefault: { value: { base: "gray.800", _dark: "#E8EDF4" } },
        fgMuted: { value: { base: "gray.600", _dark: "#A9B4C2" } },
        borderDefault: { value: { base: "gray.200", _dark: "whiteAlpha.200" } },
        accent: {
          value: { base: "{colors.brand.500}", _dark: "{colors.brand.400}" },
        },
        accentSubtle: {
          value: {
            base: "{colors.brand.50}",
            _dark: "{colors.brand.900}",
          },
        },
        cardHoverBg: {
          value: { base: "gray.100", _dark: "whiteAlpha.100" },
        },
        link: { value: { base: "blue.600", _dark: "blue.300" } },
        // focus ring token (Chakra v3 semantic palette 仕様に近似)
        focusRing: {
          value: { base: "{colors.brand.400}", _dark: "{colors.brand.300}" },
        },
        // 状態色 (今後 colorPalette による上書きを想定)
        dangerSolid: { value: { base: "red.500", _dark: "red.400" } },
        successSolid: { value: { base: "green.500", _dark: "green.400" } },
      },
      shadows: {
        interactive: { value: { base: "{shadows.sm}", _dark: "{shadows.sm}" } },
        elevated: { value: { base: "{shadows.md}", _dark: "{shadows.md}" } },
      },
      gradients: {
        accentSoft: { value: { base: "{gradients.accentSoft}" } },
        dangerStrong: { value: { base: "{gradients.dangerStrong}" } },
        playerNumber: { value: { base: "{gradients.playerNumber}" } },
      },
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
                bg: { base: "{colors.brand.100}", _dark: "{colors.brand.800}" },
              },
              _active: {
                bg: { base: "{colors.brand.200}", _dark: "{colors.brand.700}" },
              },
            },
            soft: {
              bg: { base: "{colors.orange.50}", _dark: "{colors.orange.900}" },
              color: {
                base: "{colors.orange.600}",
                _dark: "{colors.orange.300}",
              },
              shadow: "xs",
              _hover: {
                bg: {
                  base: "{colors.orange.100}",
                  _dark: "{colors.orange.800}",
                },
                shadow: "sm",
              },
              _active: {
                bg: {
                  base: "{colors.orange.200}",
                  _dark: "{colors.orange.700}",
                },
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
            width: "140px",
            height: "180px",
          },
          inner: {
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transition: "transform {durations.normal} {easings.standard}",
          },
          front: {
            p: 3,
            borderRadius: "16px",
            borderWidth: "2px",
            fontWeight: 700,
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
          },
          back: {
            p: 3,
            borderRadius: "16px",
            borderWidth: "2px",
            fontWeight: 900,
            position: "absolute",
            inset: 0,
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
          },
          frame: {
            p: 3,
            minW: "140px",
            minH: "160px",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
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
          {
            variant: "flip",
            state: "default",
            css: {
              front: {
                bgGradient: "linear(135deg,#2D3748,#1A202C)",
                borderColor: "borderDefault",
                boxShadow: "md",
                color: "#E2E8F0",
              },
              back: {
                bgGradient: "linear(135deg,#2D3748,#1A202C)",
                borderColor: "borderDefault",
                boxShadow: "md",
                color: "#112025",
              },
            },
          },
          {
            variant: "flip",
            state: "success",
            css: {
              front: {
                bgGradient: "linear(135deg,#2D3748,#1A202C)",
                borderColor: "teal.300",
                boxShadow: "glow",
                color: "#E2E8F0",
              },
              back: {
                bgGradient: "linear(135deg,#38B2AC,#2C7A7B)",
                borderColor: "teal.300",
                boxShadow: "glow",
                color: "#112025",
              },
            },
          },
          {
            variant: "flip",
            state: "fail",
            css: {
              front: {
                bgGradient: "linear(135deg,#2D3748,#1A202C)",
                borderColor: "red.300",
                boxShadow: "glowDanger",
                color: "#E2E8F0",
              },
              back: {
                bgGradient: "linear(135deg,#742A2A,#E53E3E)",
                borderColor: "red.300",
                boxShadow: "glowDanger",
                color: "#112025",
              },
            },
          },
          {
            variant: "flat",
            state: "default",
            css: {
              frame: {
                bgGradient:
                  "linear(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
                border: "1px solid rgba(255,255,255,0.04)",
                boxShadow: "inset 0 -6px 18px rgba(0,0,0,0.2)",
              },
            },
          },
          {
            variant: "flat",
            state: "success",
            css: {
              frame: {
                bgGradient:
                  "linear(180deg, rgba(56,178,172,0.25), rgba(0,0,0,0.08))",
                boxShadow:
                  "0 0 0 2px rgba(56,178,172,0.55), 0 0 18px -4px rgba(56,178,172,0.5), inset 0 -6px 18px rgba(0,0,0,0.25)",
              },
            },
          },
          {
            variant: "flat",
            state: "fail",
            css: {
              frame: {
                bgGradient:
                  "linear(180deg, rgba(220,50,50,0.45), rgba(0,0,0,0.15))",
                boxShadow:
                  "0 0 0 2px rgba(255,80,80,0.7), 0 0 22px -4px rgba(255,80,80,0.6), inset 0 -6px 18px rgba(0,0,0,0.4)",
              },
            },
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
