import { extendTheme, ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
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
      50: "#e3f2ff",
      100: "#b9dcff",
      200: "#8ec6ff",
      300: "#63afff",
      400: "#3999ff",
      500: "#1f7fe6",
      600: "#155fb4",
      700: "#0d4082",
      800: "#052151",
      900: "#000521",
    },
  },
  semanticTokens: {
    colors: {
      // Canvas & panels
      canvasBg: { default: "#0A1020", _dark: "#0A1020" },
      panelBg: { default: "#121A2A", _dark: "#121A2A" },
      panelSubBg: { default: "#0F1726", _dark: "#0F1726" },
      // Foreground
      fgDefault: { default: "#E5ECF8", _dark: "#E5ECF8" },
      fgMuted: { default: "#B1C0D8", _dark: "#B1C0D8" },
      fgSubtle: { default: "#8EA0BD", _dark: "#8EA0BD" },
      // Accent
      accentSolid: { default: "#3999ff", _dark: "#3999ff" },
      accentHover: { default: "#63afff", _dark: "#63afff" },
      accentSubtle: { default: "rgba(57,153,255,0.16)", _dark: "rgba(57,153,255,0.16)" },
      // States
      success: { default: "#28C781", _dark: "#28C781" },
      error: { default: "#FF5C5C", _dark: "#FF5C5C" },
      warning: { default: "#FFC24B", _dark: "#FFC24B" },
      // Borders & rings
      borderDefault: { default: "rgba(255,255,255,0.08)", _dark: "rgba(255,255,255,0.08)" },
      textMuted: { default: "gray.600", _dark: "gray.300" },
    },
  },
  textStyles: {
    hint: { fontSize: "sm", color: "textMuted" },
    numeric: { fontVariantNumeric: "tabular-nums" },
  },
  layerStyles: {
    panel: {
      borderWidth: "1px",
      borderRadius: "md",
      bg: "panelBg",
      borderColor: "borderDefault",
    },
    panelSub: {
      borderWidth: "1px",
      borderRadius: "md",
      bg: "panelSubBg",
      borderColor: "borderDefault",
    },
    hud: {
      borderBottomWidth: "1px",
      borderColor: "borderDefault",
      bg: "#0D1424",
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
  shadows: {
    outline: "0 0 0 3px rgba(57,153,255,0.56)",
    card: "0 10px 30px rgba(0,0,0,0.35)",
    cardHover: "0 16px 44px rgba(0,0,0,0.42)",
  },
  components: {
    Card: {
      baseStyle: {
        borderRadius:  "xl",
        boxShadow: "card",
      },
    },
    Button: {
      defaultProps: {
        colorScheme: "blue",
      },
    },
  },
});

export default theme;
