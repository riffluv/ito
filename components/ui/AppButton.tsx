"use client"
import { chakra, useRecipe, Button as CButton } from "@chakra-ui/react"
import { buttonRecipe } from "../../theme/recipes/button.recipe"

type Visual = "solid" | "outline" | "ghost" | "subtle" | "soft" | "link"
type Palette = "brand" | "orange" | "gray"

type AppButtonProps = React.ComponentProps<typeof CButton> & {
  size?: "xs" | "sm" | "md" | "lg"
  density?: "compact" | "comfortable"
  visual?: Visual
  palette?: Palette
}

export function AppButton({
  size = "md",
  density = "comfortable",
  visual,
  palette,
  variant,
  colorPalette,
  ...rest
}: AppButtonProps) {
  const recipe = useRecipe({ recipe: buttonRecipe })
  const styles = recipe({ size, density, visual: (visual as any) ?? undefined, palette: (palette as any) ?? undefined })

  // Chakraのvariant/colorPaletteを尊重。recipe指定がある場合のみデフォルトを補う。
  const computedVariant = variant ?? visual ?? "solid"
  const computedPalette = colorPalette ?? palette ?? ("brand" as any)

  return (
    <CButton
      {...(styles as any)}
      variant={computedVariant}
      colorPalette={computedPalette as any}
      {...rest}
    />
  )
}

export default AppButton
