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
  css,
  ...rest
}: AppButtonProps) {
  // Chakraのvariant/colorPaletteを最優先、次にlocal props
  const finalVariant = variant ?? visual ?? "solid"
  const finalPalette = colorPalette ?? palette
  
  // recipe classNameを追加（Chakra UI v3のCSS-in-JSとの連携）
  const combinedClassName = `${buttonRecipe.className ?? ''} ${className ?? ''}`.trim()

  // 🎮 PREMIUM BUTTON ENHANCEMENT
  const premiumStyles = css || {};

  return (
    <CButton
      variant={finalVariant}
      colorPalette={finalPalette}
      className={combinedClassName}
      css={{
        // Base premium styling for all buttons
        transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        cursor: "pointer",
        userSelect: "none",
        
        // Enhanced focus states
        _focusVisible: {
          outline: "2px solid rgba(59,130,246,0.6)",
          outlineOffset: "2px",
        },
        
        // Enhanced disabled states
        _disabled: {
          opacity: 0.6,
          cursor: "not-allowed",
          transform: "none !important",
        },
        
        // Enhanced active states
        _active: {
          transform: "scale(0.98)",
        },
        
        // Apply custom styles last to allow overrides
        ...premiumStyles,
      }}
      {...rest}
    />
  )
}

export default AppButton
