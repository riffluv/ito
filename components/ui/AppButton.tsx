"use client"
import { Button as CButton } from "@chakra-ui/react"
import { buttonRecipe } from "../../theme/recipes/button.recipe"

// theme/recipes/button.recipe.ts から型を抽出
type ButtonVariants = {
  size?: "xs" | "sm" | "md" | "lg"
  density?: "compact" | "comfortable"
  visual?: "solid" | "outline" | "ghost" | "subtle" | "surface" | "plain"
  palette?: "brand" | "orange" | "gray"
}

type AppButtonProps = React.ComponentProps<typeof CButton> & ButtonVariants & {
  // Linkサポート（as={Link}時にhrefを型的に許可）
  href?: string
}

export function AppButton({
  size = "md",
  density = "comfortable",
  visual = "solid",
  palette = "brand",
  variant,
  colorPalette,
  className,
  ...rest
}: AppButtonProps) {
  // Chakraのvariant/colorPaletteを最優先、次にlocal props
  const finalVariant = variant ?? visual ?? "solid"
  const finalPalette = colorPalette ?? palette
  
  // recipe classNameを追加（Chakra UI v3のCSS-in-JSとの連携）
  const combinedClassName = `${buttonRecipe.className ?? ''} ${className ?? ''}`.trim()

  return (
    <CButton
      variant={finalVariant}
      colorPalette={finalPalette}
      className={combinedClassName}
      {...rest}
    />
  )
}

export default AppButton
