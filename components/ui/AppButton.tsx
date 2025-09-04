"use client";
import { Button as CButton } from "@chakra-ui/react";
import { buttonRecipe } from "../../theme/recipes/button.recipe";

type ButtonVariants = {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  density?: "compact" | "comfortable";
  visual?: "solid" | "outline" | "ghost" | "subtle" | "surface" | "plain";
  palette?: "brand" | "gray" | "danger" | "success" | "teal";
};

type AppButtonProps = React.ComponentProps<typeof CButton> & ButtonVariants & {
  href?: string;
};

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
  const finalPalette = (colorPalette ?? palette) as NonNullable<ButtonVariants["palette"]>;

  // レシピclass名 + 呼び出し側のclassNameを合成
  const combinedClassName = `${buttonRecipe.className ?? ''} ${className ?? ''}`.trim();

  // DQ風（中）: フラット塗り＋2px枠＋上下ベベル（JS適用）
  const palettes = {
    brand: { baseBg: "accentActive", hoverBg: "accent", borderColor: "borderAccent" },
    gray: { baseBg: "surfaceRaised", hoverBg: "bgMuted", borderColor: "border" },
    danger: { baseBg: "dangerSolid", hoverBg: "#DC2626", borderColor: "dangerBorder" },
    success: { baseBg: "successSolid", hoverBg: "#16A34A", borderColor: "successBorder" },
    teal: { baseBg: "secondary", hoverBg: "secondaryHover", borderColor: "secondaryActive" },
  } as const;
  const p = palettes[finalPalette] ?? palettes.brand;

  const dqSolid = visual === "solid" ? {
    background: p.baseBg,
    color: "white",
    border: "2px solid",
    borderColor: p.borderColor,
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.25)",
    _hover: {
      background: p.hoverBg,
      transform: "translateY(-1px)",
      boxShadow: "inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.38), 0 3px 0 rgba(0,0,0,0.25)",
    },
    _active: {
      transform: "translateY(0)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 0 rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.3)",
    },
  } : {};

  const dqOutline = visual === "outline" ? {
    background: "glassBg05",
    border: "2px solid",
    borderColor: "border",
    _hover: { background: "glassBg08" },
  } : {};

  const dqGhost = visual === "ghost" ? {
    background: "transparent",
    border: "1px solid transparent",
    _hover: { background: "glassBg06", borderColor: "border" },
  } : {};

  const premiumStyles = {
    ...dqSolid,
    ...dqOutline,
    ...dqGhost,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    ...((css as any) || {}),
  };

  return (
    <CButton
      variant="plain"
      className={combinedClassName}
      data-size={size}
      data-density={density}
      data-visual={visual}
      data-palette={finalPalette}
      css={premiumStyles}
      {...rest}
    />
  );
}

export default AppButton;

