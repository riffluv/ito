import { defineRecipe } from "@chakra-ui/react"

export const buttonRecipe = defineRecipe({
  className: "app-btn",
  base: {
    fontWeight: "semibold",
    rounded: "full",
    transition: "all 0.2s ease",
    _focusVisible: {
      outline: "2px solid",
      outlineOffset: "2px",
    },
  },
  variants: {
    size: {
      sm: { px: 3, py: 1.5, fontSize: "sm" },
      md: { px: 4, py: 2, fontSize: "sm" },
      lg: { px: 6, py: 3, fontSize: "md" },
    },
    density: {
      compact: { py: 1.5 },
      comfortable: { py: 2.5 },
    },
    visual: {
      solid: { boxShadow: "sm" },
      outline: { boxShadow: "none", _hover: { boxShadow: "sm" } },
      ghost: { boxShadow: "none" },
    },
    palette: {
      brand: { _focusVisible: { outlineColor: "{colors.brand.400}" } },
      orange: { _focusVisible: { outlineColor: "{colors.orange.400}" } },
      gray: { _focusVisible: { outlineColor: "{colors.gray.400}" } },
    },
  },
  defaultVariants: { size: "md", density: "comfortable", visual: "solid", palette: "brand" },
})

export default buttonRecipe
