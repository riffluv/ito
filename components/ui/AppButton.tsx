"use client"
import { Button as CButton } from "@chakra-ui/react"
import { buttonRecipe } from "../../theme/recipes/button.recipe"

// theme/recipes/button.recipe.ts から型を抽出
type ButtonVariants = {
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  density?: "compact" | "comfortable"
  visual?: "solid" | "outline" | "ghost" | "subtle" | "surface" | "plain"
  palette?: "brand" | "gray" | "danger" | "success"
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
  css,
  ...rest
}: AppButtonProps) {
  // Chakraのvariant/colorPaletteを最優先、次にlocal props
  const finalVariant = variant ?? visual ?? "solid"
  const finalPalette = colorPalette ?? palette
  
  // recipe classNameを追加（Chakra UI v3のCSS-in-JSとの連携）
  const combinedClassName = `${buttonRecipe.className ?? ''} ${className ?? ''}`.trim()

  // 🎮 PREMIUM BUTTON ENHANCEMENT - Professional Grade
  const premiumStyles = {
    // Enhanced typography for better readability
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    
    // Professional interaction states
    _hover: {
      ...((css as any)?._hover || {}),
    },
    _active: {
      ...((css as any)?._active || {}),
    },
    _focus: {
      ...((css as any)?._focus || {}),
    },
    
    // Custom styles override
    ...(css || {}),
  };

  return (
    <CButton
      variant={finalVariant}
      colorPalette={finalPalette}
      className={combinedClassName}
      css={premiumStyles}
      {...rest}
    />
  )
}

export default AppButton
