"use client";

import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { UI_TOKENS, UNIFIED_LAYOUT } from "@/theme/layout";
import {
  Button as ChakraButton,
  type ButtonProps,
  type SystemStyleObject,
} from "@chakra-ui/react";
import React, { useCallback } from "react";

type ButtonVisual =
  | "solid"
  | "outline"
  | "ghost"
  | "subtle"
  | "surface"
  | "plain"
  | "link";

type ButtonPalette =
  | "brand"
  | "gray"
  | "danger"
  | "success"
  | "teal"
  | "purple"
  | "orange";

export type AppButtonProps = Omit<ButtonProps, "variant" | "colorScheme"> & {
  visual?: ButtonVisual;
  variant?: ButtonVisual;
  palette?: ButtonPalette;
  colorPalette?: ButtonPalette;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  density?: "compact" | "comfortable";
  href?: string;
  target?: string;
  rel?: string;
};

export const useButtonAnimation = () => {
  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.transform = "translateY(0px)";
  };
  const handleMouseUp = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.transform = "translateY(-1px)";
  };
  const handleMouseEnter = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.transform = "translateY(-1px)";
  };
  const handleMouseLeave = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.transform = "translateY(0px)";
  };
  return { handleMouseDown, handleMouseUp, handleMouseEnter, handleMouseLeave };
};

type PaletteConfig = {
  background: string;
  hoverBg: string;
  border: string;
  textColor: string;
};

const PALETTES: Record<ButtonPalette, PaletteConfig> = {
  brand: {
    background: "rgba(20, 23, 34, 0.93)", // 指示書: 5刻み回避（0.93）
    hoverBg: "rgba(28, 32, 45, 0.96)",    // 指示書: 微差（0.96）
    border: "3px solid rgba(255,255,255,0.88)", // 指示書: 奇数的不透明度
    textColor: "#fff",
  },
  gray: {
    background: "rgba(71, 85, 105, 0.89)",  // 指示書: 0.9→0.89
    hoverBg: "rgba(75, 85, 99, 0.94)",      // 指示書: 0.95→0.94
    border: "3px solid rgba(255,255,255,0.68)", // 指示書: 0.7→0.68
    textColor: "#fff",
  },
  danger: {
    background: "rgba(185, 28, 28, 0.91)",  // 指示書: 0.92→0.91
    hoverBg: "rgba(220, 38, 38, 0.94)",     // 指示書: 0.95→0.94
    border: "3px solid rgba(255,255,255,0.83)", // 指示書: 0.85→0.83
    textColor: "#fff",
  },
  success: {
    background: "rgba(22, 163, 74, 0.88)",  // 指示書: 0.9→0.88
    hoverBg: "rgba(34, 197, 94, 0.93)",     // 指示書: 0.95→0.93
    border: "3px solid rgba(255,255,255,0.84)", // 指示書: 0.85→0.84
    textColor: "#fff",
  },
  teal: {
    background: "rgba(20, 184, 166, 0.91)", // 指示書: 0.92→0.91
    hoverBg: "rgba(45, 212, 191, 0.95)",    // 指示書: 0.96→0.95
    border: "3px solid rgba(255,255,255,0.84)", // 指示書: 0.85→0.84
    textColor: "#fff",
  },
  purple: {
    background: "rgba(126, 34, 206, 0.91)", // 指示書: 0.92→0.91
    hoverBg: "rgba(147, 51, 234, 0.96)",    // 指示書: 0.97→0.96
    border: "3px solid rgba(255,255,255,0.84)", // 指示書: 0.85→0.84
    textColor: "#fff",
  },
  orange: {
    background: "rgba(246, 107, 30, 0.93)", // 指示書: 0.94→0.93
    hoverBg: "rgba(255, 142, 60, 0.97)",    // 指示書: 0.98→0.97
    border: "3px solid rgba(255,255,255,0.91)", // 指示書: 0.92→0.91
    textColor: "#fff",
  },
};

const getSolidStyles = (palette: ButtonPalette): SystemStyleObject => {
  const p = PALETTES[palette];
  return {
    background: p.background,
    color: p.textColor,
    border: p.border,
    borderRadius: "3px", // 指示書: 角丸3px（AI感排除）
    fontWeight: 690, // 指示書: 偶数回避→奇数的な値（700→690）
    textShadow: "1px 1px 0 rgba(0,0,0,0.73)", // 指示書: 0.75→0.73（微差）
    // 指示書準拠: 段積み影でピクセル風（ぼかし削減）+ 微差の非均一
    boxShadow: `
      2px 3px 0 rgba(0,0,0,0.28),
      inset 0 1px 0 rgba(255,255,255,0.09),
      inset 0 -3px 0 rgba(0,0,0,0.37)
    `,
    "&:hover": {
      background: p.hoverBg,
      transform: "translate(-0.5px, -1px)", // 指示書: 微小上移動+非対称（手癖）
      boxShadow: `
        3px 4px 0 rgba(0,0,0,0.29),
        inset 0 1px 0 rgba(255,255,255,0.13),
        inset 0 -3px 0 rgba(0,0,0,0.42)
      `,
    },
    "&:active": {
      transform: "translateY(1px)", // 指示書: 押し込み感（物理感）
      boxShadow: `
        1px 2px 0 rgba(0,0,0,0.37),
        inset 0 2px 0 rgba(0,0,0,0.32)
      `,
    },
    "&:disabled": {
      filter: "grayscale(38%)", // 指示書: 40%→38%（偶数回避）
      opacity: 0.68, // 指示書: 0.7→0.68（小数点2桁で微差）
      cursor: "not-allowed",
      transform: "translateY(0)",
      boxShadow: "1px 2px 0 rgba(0,0,0,0.19)", // 指示書: 0.2→0.19
    },
  };
};

const getOutlineStyles = (palette: ButtonPalette): SystemStyleObject => {
  const p = PALETTES[palette];
  return {
    background: "rgba(0,0,0,0.23)", // 指示書: 0.25→0.23
    color: p.textColor,
    border: "2px solid rgba(255,255,255,0.58)", // 指示書: 0.6→0.58
    borderRadius: "3px", // 指示書: 統一感のある微差
    fontWeight: 580, // 指示書: 600→580（偶数回避）
    textShadow: "1px 1px 0 rgba(0,0,0,0.58)", // 指示書: 0.6→0.58（役割差）
    boxShadow: "1px 2px 0 rgba(0,0,0,0.14)", // 指示書: 0.15→0.14
    "&:hover": {
      background: "rgba(255,255,255,0.09)", // 指示書: 0.1→0.09
      borderColor: "rgba(255,255,255,0.83)", // 指示書: 0.85→0.83
      transform: "translate(-0.5px, -1px)", // 指示書: ホバーで微動
      boxShadow: "2px 3px 0 rgba(0,0,0,0.19)", // 指示書: 0.2→0.19
    },
    "&:active": {
      background: "rgba(0,0,0,0.37)", // 指示書: 0.35→0.37
      transform: "translateY(1px)", // 指示書: 押し込み
      boxShadow: "0 1px 0 rgba(0,0,0,0.18)", // 指示書: 0.2→0.18
    },
    "&:disabled": {
      opacity: 0.63, // 指示書: 0.65→0.63（5刻み回避）
      cursor: "not-allowed",
      transform: "none",
      boxShadow: "none",
    },
  };
};

const getGhostStyles = (): SystemStyleObject => ({
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: "3px", // 指示書: 全variant統一
  "&:hover": {
    background: "rgba(255,255,255,0.058)", // 指示書: 0.06→0.058（3桁で微差）
    transform: "translate(-0.5px, -1px)", // 指示書: 控えめな動き
  },
  "&:active": {
    background: "rgba(255,255,255,0.11)", // 指示書: 0.12→0.11（偶数回避）
    transform: "translateY(0.5px)", // 指示書: 軽い押し込み
  },
});

const getStylesForVisual = (
  visual: ButtonVisual,
  palette: ButtonPalette
): SystemStyleObject => {
  switch (visual) {
    case "outline":
      return getOutlineStyles(palette);
    case "ghost":
    case "plain":
    case "link":
      return getGhostStyles();
    default:
      return getSolidStyles(palette);
  }
};

export function AppButton({
  size = "md",
  density = "comfortable",
  visual: visualProp,
  variant: variantProp,
  palette = "brand",
  colorPalette,
  className,
  css,
  onMouseDown,
  onMouseUp,
  onMouseEnter,
  onMouseLeave,
  onPointerDown,
  onPointerUp,
  onKeyDown,
  onKeyUp,
  ...rest
}: AppButtonProps) {
  const visual = (visualProp ?? variantProp ?? "solid") as ButtonVisual;
  const activePalette = (colorPalette ?? palette) as ButtonPalette;
  const animation = useButtonAnimation();
  const playPress = useSoundEffect("ui_click");

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      animation.handleMouseDown(event);
      playPress();
      onMouseDown?.(event);
    },
    [animation, onMouseDown, playPress]
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      animation.handleMouseUp(event);
      onMouseUp?.(event);
    },
    [animation, onMouseUp]
  );

  const handleMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      animation.handleMouseEnter(event);
      onMouseEnter?.(event);
    },
    [animation, onMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      animation.handleMouseLeave(event);
      onMouseLeave?.(event);
    },
    [animation, onMouseLeave]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== "mouse") {
        playPress();
      }
      onPointerDown?.(event);
    },
    [onPointerDown, playPress]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerUp?.(event);
    },
    [onPointerUp]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === " " || event.key === "Enter") {
        playPress();
      }
      onKeyDown?.(event);
    },
    [onKeyDown, playPress]
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyUp?.(event);
    },
    [onKeyUp]
  );

  const variantStyles = getStylesForVisual(visual, activePalette);

  const baseStyles: SystemStyleObject = {
    borderRadius: "3px", // 指示書: 基本は3px
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    // 指示書: 奇数px + 微差でAI感排除
    letterSpacing: visual === "solid" ? "0.02em" : "0.01em",
    // 指示書: 手癖イージング cubic-bezier(.2,1,.3,1) + 180ms（中途半端な数値）
    transition: `transform 180ms cubic-bezier(.2,1,.3,1), background 180ms cubic-bezier(.2,1,.3,1), box-shadow 180ms cubic-bezier(.2,1,.3,1)`,
    position: "relative",
    overflow: "hidden",
    "@media (pointer: coarse)": {
      minHeight: UNIFIED_LAYOUT.BUTTON.MIN_HEIGHT,
    },
    "&:focus-visible": {
      outline: "2px solid rgba(124, 221, 255, 0.7)", // 指示書: 2-3pxが適切
      outlineOffset: "2px",
    },
    ...(css ?? {}),
  };

  if (visual === "solid") {
    // 指示書: グラデは削除（綺麗すぎる=AI感）、代わりにシンプルな立体感
    baseStyles["&::before"] = {
      content: '""',
      position: "absolute",
      inset: "3px", // 指示書: 奇数pxで微差
      pointerEvents: "none",
      background: "rgba(255,255,255,0.074)", // 指示書: 0.08→0.074（3桁で微差）
      opacity: 0.88, // 指示書: 0.9→0.88（5刻み回避）
    };
  }

  return (
    <ChakraButton
      variant="plain"
      size={size}
      data-density={density}
      data-visual={visual}
      data-palette={activePalette}
      className={className}
      css={{ ...baseStyles, ...variantStyles }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      {...rest}
    />
  );
}

export default AppButton;
