"use client";
import { Box } from "@chakra-ui/react";
import React from "react";

interface DiamondNumberCardProps {
  number: number | null;
  isAnimating?: boolean;
}

export function DiamondNumberCard({ number, isAnimating = false }: DiamondNumberCardProps) {
  return (
    <Box
      w="80px"
      h="80px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0} // 縮まないように固定
      css={{
        // ダイヤモンド型のクリッピング
        clipPath: "polygon(18% 0%, 82% 0%, 100% 50%, 82% 100%, 18% 100%, 0% 50%)",
        // オクトパス風のリッチなグラデーション背景
        background: typeof number === "number"
          ? "linear-gradient(135deg, #8B4513 0%, #A0522D 20%, #654321 45%, #4A2C14 70%, #2F1B0C 100%)"
          : "linear-gradient(135deg, #444 0%, #555 20%, #333 45%, #222 70%, #111 100%)",
        // 立体感のあるボーダー
        border: `3px solid ${typeof number === "number" ? "rgba(255,215,0,0.9)" : "rgba(255,255,255,0.6)"}`,
        // リッチなシャドウ効果
        boxShadow: `
          inset 2px 2px 4px rgba(255,255,255,0.3),
          inset -2px -2px 4px rgba(0,0,0,0.8),
          0 6px 20px rgba(0,0,0,0.7),
          0 0 24px ${typeof number === "number" ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.2)"}
        `,
        transform: isAnimating ? "scale(1.1) rotate(3deg)" : "scale(1)",
        transition: "all 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        // 少し浮いている感じを演出
        filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.6))",
      }}
    >
      <Box
        fontSize={
          typeof number === "number" && String(number).length >= 3
            ? { base: "28px", md: "34px" } // 3桁数字対応
            : { base: "34px", md: "40px" } // 1-2桁数字
        }
        fontWeight={900}
        color="white"
        textAlign="center"
        lineHeight={1}
        css={{
          fontVariantNumeric: "tabular-nums",
          fontFamily: "'SF Mono','Cascadia Mono','Menlo','Roboto Mono',monospace",
          textShadow: "2px 2px 4px rgba(0,0,0,0.9), 0 0 12px rgba(255,215,0,0.6)",
          letterSpacing: typeof number === "number" && String(number).length >= 3
            ? "-0.05em"
            : "0.05em",
          // 数字に強めのグロー効果
          filter: typeof number === "number"
            ? "drop-shadow(0 0 10px rgba(255,215,0,0.8))"
            : "none",
        }}
      >
        {typeof number === "number" ? number : "??"}
      </Box>

      {/* 装飾的なハイライト */}
      <Box
        position="absolute"
        top="10px"
        left="50%"
        w="24px"
        h="2px"
        borderRadius="1px"
        transform="translateX(-50%)"
        css={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)",
        }}
      />
      <Box
        position="absolute"
        bottom="10px"
        left="50%"
        w="18px"
        h="1px"
        borderRadius="1px"
        transform="translateX(-50%)"
        css={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
        }}
      />
    </Box>
  );
}