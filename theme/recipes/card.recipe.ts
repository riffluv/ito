import { defineRecipe } from "@chakra-ui/react"

export const cardRecipe = defineRecipe({
  className: "app-card",
  base: {
    bg: "panelBg",
    color: "fgDefault",
    borderWidth: "1px",
    borderColor: "borderDefault",
    rounded: "lg",
    shadow: "xs",
    p: 6,
    transition: "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease",
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
  defaultVariants: { interactive: false, density: "comfortable", selected: false },
})

export default cardRecipe
