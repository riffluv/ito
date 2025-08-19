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
      panelBg: {
        default: "blackAlpha.300",
        _dark: "blackAlpha.300",
      },
      panelSubBg: {
        default: "blackAlpha.400",
        _dark: "blackAlpha.400",
      },
      textMuted: {
        default: "gray.600",
        _dark: "gray.300",
      },
    },
  },
  textStyles: {
    hint: { fontSize: "sm", color: "textMuted" },
  },
  layerStyles: {
    panel: {
      borderWidth: "1px",
      borderRadius: "md",
      bg: "panelBg",
    },
    panelSub: {
      borderWidth: "1px",
      borderRadius: "md",
      bg: "panelSubBg",
    },
  },
  shadows: {
    outline: "0 0 0 3px rgba(57,153,255,0.6)",
  },
  components: {
    Card: {
      baseStyle: {
        borderRadius: "lg",
        boxShadow: "md",
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
