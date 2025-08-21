import { defineRecipe } from "@chakra-ui/react"

export const cardRecipe = defineRecipe({
  className: "app-card",
  base: {
    bg: "panelBg",
    color: "fgDefault",
    borderWidth: "1px",
    borderColor: "borderDefault",
    rounded: "xl",
    shadow: "sm",
    p: 5,
    transition: "all 0.2s ease",
  },
  variants: {
    interactive: {
      true: {
        _hover: {
          shadow: "md",
          borderColor: "accent",
          bg: "cardHoverBg",
          transform: "translateY(-1px)",
        },
      },
      false: {},
    },
    density: {
      compact: { p: 4 },
      comfortable: { p: 5 },
    },
    selected: {
      true: { borderColor: "accent", shadow: "md" },
      false: {},
    },
  },
  defaultVariants: { interactive: false, density: "comfortable", selected: false },
})

export default cardRecipe
