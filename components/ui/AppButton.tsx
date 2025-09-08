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

// ✅ 高度なボタンアニメーション (エージェント対応)
export const useButtonAnimation = () => {
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(0px)";
  };
  
  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(-1px)";
  };
  
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(-1px)";
  };
  
  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(0px)";
  };

  return { handleMouseDown, handleMouseUp, handleMouseEnter, handleMouseLeave };
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
  const animation = useButtonAnimation();

  // レシピclass名 + 呼び出し側のclassNameを合成（テスト: buttonRecipeを無効化）
  const combinedClassName = `${className ?? ''}`.trim();

  // DQ風（中）: フラット塗り＋2px枠＋上下ベベル（JS適用）
  const palettes = {
    brand: { baseBg: "accentActive", hoverBg: "accent", borderColor: "borderAccent" },
    gray: { baseBg: "surfaceRaised", hoverBg: "bgMuted", borderColor: "border" },
    danger: { baseBg: "dangerSolid", hoverBg: "#DC2626", borderColor: "dangerBorder" },
    success: { baseBg: "successSolid", hoverBg: "#16A34A", borderColor: "successBorder" },
    teal: { baseBg: "secondary", hoverBg: "secondaryHover", borderColor: "secondaryActive" },
  } as const;
  const p = palettes[finalPalette] ?? palettes.brand;

  // ✅ 最適化: JS統一アプローチ (CSS競合回避)
  const dqSolid = visual === "solid" ? {
    background: p.baseBg,
    color: "white",
    border: "2px solid",
    borderColor: p.borderColor,
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.25)",
    // transform/hoverアニメーションはJSイベントで統一管理
  } : {};

  const dqOutline = visual === "outline" ? {
    background: "glassBg05",
    border: "2px solid",
    borderColor: "border",
    // hover/activeはJSイベントで管理
  } : {};

  const dqGhost = visual === "ghost" ? {
    background: "transparent",
    border: "1px solid transparent",
    // hover/activeはJSイベントで管理
  } : {};

  const premiumStyles = {
    ...dqSolid,
    ...dqOutline,
    ...dqGhost,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    transition: "all 0.15s ease-out",
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
      onMouseDown={animation.handleMouseDown}
      onMouseUp={animation.handleMouseUp}
      onMouseEnter={animation.handleMouseEnter}
      onMouseLeave={animation.handleMouseLeave}
      {...rest}
    />
  );
}

export default AppButton;

