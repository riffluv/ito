"use client";
import { Box, BoxProps } from "@chakra-ui/react";
import React from "react";

/**
 * DQWindow: 初代ドラクエ風の黒窓＋白フチを簡単に適用する薄いラッパ。
 * - 背景は純黒、文字は白（コントラスト最大）
 * - 枠線はテーマトークン `borders.retrogame*` を使用
 * - 余白と行間はタイル感を出すために詰め気味
 */
export interface DQWindowProps extends BoxProps {
  /**
   * 枠線の強さ。panel=3px、thin=2px、game=1px を想定。
   */
  frame?: "panel" | "thin" | "game";
}

export function DQWindow({ frame = "thin", children, ...rest }: DQWindowProps) {
  const borderToken =
    frame === "panel"
      ? "borders.retrogame"
      : frame === "game"
      ? "borders.retrogameGame"
      : "borders.retrogameThin";

  return (
    <Box
      bg="#000"
      color="#fff"
      border={borderToken}
      // 角丸・影・ぼかしは禁止（レトロ感維持）
      borderRadius={0}
      boxShadow="none"
      backdropFilter="none"
      // タイル感（8px相当）。Chakraのスケールで近似。
      px={3}
      py={3}
      lineHeight={1}
      // 数字の桁揃え
      css={{ fontVariantNumeric: "tabular-nums", imageRendering: "pixelated" }}
      {...rest}
    >
      {children}
    </Box>
  );
}

export default DQWindow;

