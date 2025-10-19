"use client";
import { IconButton as CIconButton, useRecipe } from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { buttonRecipe } from "../../theme/recipes/button.recipe";

type Visual = "solid" | "outline" | "ghost" | "subtle" | "soft" | "link";
type Palette = "brand" | "orange" | "gray";

export type AppIconButtonProps = React.ComponentProps<typeof CIconButton> & {
  size?: "xs" | "sm" | "md" | "lg";
  visual?: Visual;
  palette?: Palette;
};

export function AppIconButton({
  size = "sm",
  visual,
  palette,
  variant,
  colorPalette,
  ...rest
}: AppIconButtonProps) {
  const recipe = useRecipe({ recipe: buttonRecipe });
  const styles = recipe({
    size,
    variant: visual as any,
  });

  const enforcedStyles = {
    ...styles,
    "@media (pointer: coarse)": {
      ...(styles as any)?.["@media (pointer: coarse)"] ?? {},
      minHeight: UNIFIED_LAYOUT.BUTTON.MIN_HEIGHT,
      minWidth: UNIFIED_LAYOUT.BUTTON.MIN_HEIGHT,
    },
  } as Record<string, unknown>;

  const computedVariant = variant ?? visual ?? "ghost";
  const computedPalette = colorPalette ?? palette ?? ("brand" as any);

  return (
    <CIconButton
      aria-label={rest["aria-label"] || "icon button"}
      {...(enforcedStyles as any)}
      variant={computedVariant}
      colorPalette={computedPalette as any}
      {...rest}
    />
  );
}

export default AppIconButton;
