import { defineRecipe } from "@chakra-ui/react";

export const cardRecipe = defineRecipe({
  className: "app-card",
  base: {
    bg: "panelBg",
    color: "fgDefault",
    rounded: "lg",
    shadow: "0 4px 16px -4px rgba(0,0,0,0.25), 0 2px 8px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
    p: 6,
    border: "1px solid rgba(255,255,255,0.1)",
    transition:
      "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease",
  },
  variants: {
    interactive: {
      true: {
        _hover: {
          shadow: "0 8px 32px -8px rgba(0,0,0,0.4), 0 4px 16px -4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
          bg: "cardHoverBg",
          transform: "translateY(-4px) scale(1.02)",
          borderColor: "rgba(255,255,255,0.15)",
        },
      },
      false: {},
    },
    density: {
      compact: { p: 5 },
      comfortable: { p: 6 },
    },
    selected: {
      true: { shadow: "md", bg: "accentSubtle" },
      false: {},
    },
  },
  defaultVariants: {
    interactive: false,
    density: "comfortable",
    selected: false,
  },
});

export default cardRecipe;
