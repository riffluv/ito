import { extendTheme, ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "system",
  useSystemColorMode: true,
};

const theme = extendTheme({
  config,
  breakpoints: {
    sm: "30em",
    md: "48em",
    lg: "62em",
    xl: "80em",
    "2xl": "96em",
  },
  colors: {
    brand: {
      50: "#E6FFFA",
      100: "#B2F5EA",
      200: "#81E6D9",
      300: "#4FD1C5",
      400: "#38B2AC",
      500: "#319795",
      600: "#2C7A7B",
      700: "#285E61",
      800: "#234E52",
      900: "#1D4044",
    },
    // 既存orangeは必要に応じて使用可能
    orange: {
      50: "#FFF5EC",
      100: "#FFE3CC",
      200: "#FFC7A1",
      300: "#FFAA75",
      400: "#FF8F3D",
      500: "#FF7A1A",
      600: "#E86A0C",
      700: "#BF5006",
      800: "#8F3B05",
      900: "#5F2703",
    },
  },
  semanticTokens: {
    colors: {
      // Canvas & panels（ライト/ダーク双方に対応）
      canvasBg: { default: "gray.50", _dark: "#0B0D10" },
      panelBg: { default: "white", _dark: "#121418" },
      panelSubBg: { default: "gray.50", _dark: "#181B20" },
      // Foreground
      fgDefault: { default: "gray.800", _dark: "#E7EBF2" },
      fgMuted: { default: "gray.600", _dark: "#A9B2BF" },
      // Accent（Chakra公式のティール系に寄せる）
      accentSolid: { default: "brand.500", _dark: "brand.400" },
      accentHover: { default: "brand.600", _dark: "brand.300" },
      accentSubtle: {
        default: "rgba(56,178,172,0.10)", // teal.400
        _dark: "rgba(56,178,172,0.16)",
      },
      // States
      success: { default: "#38A169", _dark: "#48BB78" },
      error: { default: "#E53E3E", _dark: "#F56565" },
      warning: { default: "#DD6B20", _dark: "#F6AD55" },
      // Borders & rings
      borderDefault: { default: "gray.200", _dark: "#2A2F37" },
    },
  },
  fonts: {
    heading: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    body: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  textStyles: {
    hint: { fontSize: "sm", color: "fgMuted" },
    numeric: { fontVariantNumeric: "tabular-nums" },
  },
  layerStyles: {
    panel: {
      borderWidth: "1px",
      borderRadius: "xl",
      bg: "panelBg",
      borderColor: "borderDefault",
    },
    panelSub: {
      borderWidth: "1px",
      borderRadius: "xl",
      bg: "panelSubBg",
      borderColor: "borderDefault",
    },
    hud: {
      borderBottomWidth: "1px",
      borderColor: "borderDefault",
      bg: "panelBg",
      backdropFilter: "saturate(120%) blur(6px)",
    },
    slotGuide: {
      borderWidth: "2px",
      borderStyle: "dashed",
      borderColor: "accentSubtle",
      borderRadius: "xl",
    },
    chip: {
      borderRadius: "lg",
      px: 2,
      py: 1,
      bg: "accentSubtle",
      color: "fgDefault",
      fontSize: "xs",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    },
  },
  radii: {
    xs: "6px",
    sm: "10px",
    md: "14px",
    lg: "18px",
    xl: "22px",
    full: "9999px",
  },
  shadows: {
    outline: "0 0 0 3px rgba(49,151,149,0.45)",
    card: "0 10px 30px rgba(0,0,0,0.08)",
    cardHover: "0 20px 48px rgba(0,0,0,0.12)",
    glowSuccess: "0 0 0 6px rgba(72,187,120,0.18)",
    glowFail: "0 0 0 6px rgba(245,101,101,0.18)",
  },
  components: {
    Card: {
      baseStyle: {
        borderRadius: "xl",
        boxShadow: "card",
      },
    },
    Button: {
      defaultProps: {
        colorScheme: "teal",
      },
      variants: {
        brand: {
          bg: "accentSolid",
          color: "white",
          _hover: { bg: "accentHover" },
          _active: { bg: "accentHover" },
          borderRadius: "lg",
        },
      },
    },
  },
  styles: {
    global: (props: any) => ({
      html: { scrollBehavior: "smooth" },
      body: {
        bg: "canvasBg",
        color: "fgDefault",
      },
    }),
  },
});

export default theme;
