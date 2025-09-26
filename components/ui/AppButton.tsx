"use client";
import React, { useCallback } from "react";
import { Button as CButton } from "@chakra-ui/react";
import { buttonRecipe } from "../../theme/recipes/button.recipe";
import { UI_TOKENS } from "@/theme/layout";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

type ButtonVariants = {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  density?: "compact" | "comfortable";
  visual?: "solid" | "outline" | "ghost" | "subtle" | "surface" | "plain";
  palette?: "brand" | "gray" | "danger" | "success" | "teal";
};

type AppButtonProps = React.ComponentProps<typeof CButton> & ButtonVariants & {
  href?: string;
};

// ? ????????????? (????????)
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
  onMouseDown,
  onMouseUp,
  onMouseEnter,
  onMouseLeave,
  onPointerDown,
  onKeyDown,
  ...rest
}: AppButtonProps) {
  const finalPalette = (colorPalette ?? palette) as NonNullable<ButtonVariants["palette"]>;
  const animation = useButtonAnimation();
  const playPress = useSoundEffect("ui_click");

  const handleMouseDownInternal = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    animation.handleMouseDown(event);
    playPress();
    onMouseDown?.(event);
  }, [animation, onMouseDown, playPress]);

  const handleMouseUpInternal = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    animation.handleMouseUp(event);
    onMouseUp?.(event);
  }, [animation, onMouseUp]);

  const handleMouseEnterInternal = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    animation.handleMouseEnter(event);
    onMouseEnter?.(event);
  }, [animation, onMouseEnter]);

  const handleMouseLeaveInternal = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    animation.handleMouseLeave(event);
    onMouseLeave?.(event);
  }, [animation, onMouseLeave]);

  const handlePointerDownInternal = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") {
      playPress();
    }
    onPointerDown?.(event);
  }, [onPointerDown, playPress]);

  const handleKeyDownInternal = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") {
      playPress();
    }
    onKeyDown?.(event);
  }, [onKeyDown, playPress]);


  // ???class? + ??????className???????: buttonRecipe?????
  const combinedClassName = `${className ?? ''}`.trim();

  // ??????????: ????????????? + ????
  const palettes = {
    brand: {
      baseBg: "rgba(20, 23, 34, 0.95)",
      hoverBg: "rgba(25, 28, 39, 0.98)",
      borderColor: "rgba(255,255,255,0.9)",
      textColor: "white"
    },
    gray: {
      baseBg: "rgba(71, 85, 105, 0.9)",
      hoverBg: "rgba(75, 85, 99, 0.95)",
      borderColor: "rgba(255,255,255,0.7)",
      textColor: "white"
    },
    danger: {
      baseBg: "rgba(185, 28, 28, 0.9)",
      hoverBg: "rgba(220, 38, 38, 0.95)",
      borderColor: "rgba(255,255,255,0.8)",
      textColor: "white"
    },
    success: {
      baseBg: "rgba(22, 163, 74, 0.9)",
      hoverBg: "rgba(34, 197, 94, 0.95)",
      borderColor: "rgba(255,255,255,0.8)",
      textColor: "white"
    },
    teal: {
      baseBg: "rgba(20, 184, 166, 0.9)",
      hoverBg: "rgba(45, 212, 191, 0.95)",
      borderColor: "rgba(255,255,255,0.8)",
      textColor: "white"
    },
  } as const;
  const p = palettes[finalPalette] ?? palettes.brand;

  // ? ??????????: ??????????? + ??????
  const dqSolid = visual === "solid" ? {
    background: p.baseBg,
    color: p.textColor,
    border: "3px solid",
    borderColor: p.borderColor,
    borderRadius: 0,
    fontFamily: "monospace",
    fontWeight: 700,
    letterSpacing: "0.5px",
    textShadow: "1px 1px 0px rgba(0,0,0,0.8)",
    boxShadow: `
      inset 0 2px 0 rgba(255,255,255,0.1),
      inset 0 -2px 0 rgba(0,0,0,0.4),
      0 4px 8px rgba(0,0,0,0.3),
      1px 1px 0 rgba(0,0,0,0.7),
      0 2px 0 rgba(0,0,0,0.5)
    `,
    // transform/hover????????JS?????????
  } : {};

  const dqOutline = visual === "outline" ? {
    background: "rgba(0,0,0,0.3)",
    border: "2px solid",
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 0,
    fontFamily: "monospace",
    fontWeight: 600,
    letterSpacing: "0.3px",
    textShadow: "1px 1px 0px rgba(0,0,0,0.6)",
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.1),
      0 2px 4px rgba(0,0,0,0.2)
    `,
    // hover/active?JS???????
  } : {};

  const dqGhost = visual === "ghost" ? {
    background: "transparent",
    border: "1px solid transparent",
    // hover/active?JS???????
  } : {};

  const premiumStyles = {
    ...dqSolid,
    ...dqOutline,
    ...dqGhost,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    transition: `transform 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}, background-color 0.15s ${UI_TOKENS.EASING.standard}, border-color 0.15s ${UI_TOKENS.EASING.standard}, color 0.15s ${UI_TOKENS.EASING.standard}`,
    ...((css as any) || {}),
    // ????????????????
    ...(visual === "solid"
      ? {
          "&:hover": {
            backgroundColor: p.hoverBg,
            boxShadow: `
              inset 0 2px 0 rgba(255,255,255,0.15),
              inset 0 -2px 0 rgba(0,0,0,0.5),
              0 6px 12px rgba(0,0,0,0.4),
              1px 1px 0 rgba(0,0,0,0.8),
              0 3px 0 rgba(0,0,0,0.6)
            `,
          },
          "&:active": {
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.05),
              inset 0 -1px 0 rgba(0,0,0,0.3),
              0 2px 4px rgba(0,0,0,0.2)
            `,
          },
        }
      : {}),
    ...(visual === "outline"
      ? {
          "&:hover": {
            backgroundColor: "rgba(255,255,255,0.1)",
            borderColor: "rgba(255,255,255,0.8)",
          },
          "&:active": {
            backgroundColor: "rgba(0,0,0,0.2)",
          },
        }
      : {}),
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

