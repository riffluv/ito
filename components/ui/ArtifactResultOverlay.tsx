"use client";
import React from "react";
import { Box, Text } from "@chakra-ui/react";

export interface ArtifactResultProps {
  success: boolean;
  correctCount?: number;
  totalCount?: number;
  onClose?: () => void; // 開発中は使用しない（外部から制御）
}

export default function ArtifactResultOverlay({ success, correctCount, totalCount, onClose }: ArtifactResultProps) {
  // 自動クローズは開発時の警告を避けるため無効化（ユーザークリックで閉じる）
  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      css={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(20px)",
        animation: "fadeIn 300ms ease-out",
        "@keyframes fadeIn": { from: { opacity: 0 }, to: { opacity: 1 } },
        pointerEvents: "none",
      }}
      role="presentation"
      aria-label={success ? "結果: 成功" : "結果: 失敗"}
    >
      {/* Keyframes（ローカル注入） */}
      <Box as="style">{`
        @keyframes titleIn{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes subIn{0%{opacity:0}100%{opacity:1}}
      `}</Box>

      {/* テキスト */}
      <Box textAlign="center" zIndex={10}>
        <Text
          fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
          fontSize={{ base: "48px", md: "64px" }}
          fontWeight={600}
          letterSpacing="-0.02em"
          opacity={0}
          css={{
            color: success ? "rgba(255,255,255,0.95)" : "rgba(239,68,68,1)",
            textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            animation: "titleIn 600ms ease-out 200ms forwards",
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="center" gap={3}>
            <Box>{success ? "✨" : "💥"}</Box>
            <Box>{success ? "成功" : "失敗"}</Box>
            <Box>{success ? "✨" : "💥"}</Box>
          </Box>
        </Text>
        <Text
          mt={6}
          fontSize={{ base: "16px", md: "18px" }}
          letterSpacing="-0.01em"
          fontWeight={500}
          color="rgba(255,255,255,0.8)"
          opacity={0}
          css={{ 
            animation: "subIn 500ms ease-out 600ms forwards",
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
          }}
        >
          {typeof correctCount === "number" && typeof totalCount === "number"
            ? `${correctCount}/${totalCount} 正解`
            : "完璧な順序でクリア"}
        </Text>
      </Box>
    </Box>
  );
}
