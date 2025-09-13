"use client";
import { IconButton as CIconButton, useRecipe } from "@chakra-ui/react";
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

  const computedVariant = variant ?? visual ?? "ghost";
  const computedPalette = colorPalette ?? palette ?? ("brand" as any);

  return (
    <CIconButton
      aria-label={rest["aria-label"] || "icon button"}
      {...(styles as any)}
      variant={computedVariant}
      colorPalette={computedPalette as any}
      {...rest}
    />
  );
}

export default AppIconButton;

