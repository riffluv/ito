import { createSystem, defaultConfig } from "@chakra-ui/react";

// Chakra UI v3: System ベースのテーマ設定（簡略化して型エラーを回避）
export const system = createSystem(defaultConfig, {
  preflight: true,
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
          value: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        },
        body: {
          value: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        },
      },
      radii: {
        xs: { value: "6px" },
        sm: { value: "10px" },
        md: { value: "14px" },
        lg: { value: "18px" },
        xl: { value: "22px" },
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
    },
    semanticTokens: {
      colors: {
        canvasBg: { value: { base: "gray.50", _dark: "#0B0D10" } },
        panelBg: { value: { base: "white", _dark: "#121418" } },
        panelSubBg: { value: { base: "gray.50", _dark: "#181B20" } },
        fgDefault: { value: { base: "gray.800", _dark: "#E7EBF2" } },
        fgMuted: { value: { base: "gray.600", _dark: "#A9B2BF" } },
        borderDefault: { value: { base: "gray.200", _dark: "#2A2F37" } },
        accent: {
          value: { base: "{colors.brand.500}", _dark: "{colors.brand.400}" },
        },
      },
    },
    // v3では layerStyles/textStyles は recipes/slot recipes 推奨だが、
    // ここでは tokens/semanticTokens をメインに定義
  },
});

export default system;
