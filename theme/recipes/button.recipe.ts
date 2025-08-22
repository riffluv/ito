import { defineRecipe } from "@chakra-ui/react"

export const buttonRecipe = defineRecipe({
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
        _hover: { bg: { base: "{colors.brand.100}", _dark: "{colors.brand.800}" } },
        _active: { bg: { base: "{colors.brand.200}", _dark: "{colors.brand.700}" } },
      },
      soft: {
        bg: { base: "{colors.orange.50}", _dark: "{colors.orange.900}" },
        color: { base: "{colors.orange.600}", _dark: "{colors.orange.300}" },
        shadow: "xs",
        _hover: {
          bg: { base: "{colors.orange.100}", _dark: "{colors.orange.800}" },
          shadow: "sm",
        },
        _active: {
          bg: { base: "{colors.orange.200}", _dark: "{colors.orange.700}" },
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
  defaultVariants: { size: "md", density: "comfortable", visual: "solid", palette: "brand" },
})

export default buttonRecipe
