"use client";
import { useMemo } from "react";
import {
  chakra,
  IconButton as CIconButton,
  useRecipe,
  type SystemStyleObject,
} from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { buttonRecipe } from "../../theme/recipes/button.recipe";

type Visual = "dq" | "solid" | "outline" | "ghost" | "danger" | "success" | "highlight" | "subtle" | "soft" | "link";
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
  const resolveVisual = (value: Visual | undefined): "dq" | "solid" | "outline" | "ghost" | "danger" | "success" | "highlight" => {
    switch (value) {
      case "dq":
      case "solid":
      case "outline":
      case "ghost":
      case "danger":
      case "success":
      case "highlight":
        return value;
      default:
        return "ghost";
    }
  };
  const recipeVariant = resolveVisual(visual);
  const baseStyles = recipe({
    size,
    variant: recipeVariant,
  }) as SystemStyleObject;

  const coarsePointerStyles =
    (baseStyles["@media (pointer: coarse)"] as SystemStyleObject | undefined) ?? {};

  const enforcedStyles: SystemStyleObject = {
    ...baseStyles,
    "@media (pointer: coarse)": {
      ...coarsePointerStyles,
      minHeight: UNIFIED_LAYOUT.BUTTON.MIN_HEIGHT,
      minWidth: UNIFIED_LAYOUT.BUTTON.MIN_HEIGHT,
    },
  };

  const computedPalette = colorPalette ?? palette ?? "brand";

  const StyledIconButton = useMemo(() => chakra(CIconButton), []);

  return (
    <StyledIconButton
      aria-label={rest["aria-label"] || "icon button"}
      css={enforcedStyles}
      variant={variant}
      colorPalette={computedPalette}
      {...rest}
    />
  );
}

export default AppIconButton;
