"use client";
import { Box, Text } from "@chakra-ui/react";

export interface ArtifactResultProps {
  success: boolean;
  correctCount?: number;
  totalCount?: number;
  onClose?: () => void; // 開発中は使用しない（外部から制御）
}

export default function ArtifactResultOverlay({
  success,
  correctCount,
  totalCount,
  onClose,
}: ArtifactResultProps) {
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
        // メインメニューと調和した高級感ある背景
        background: "linear-gradient(135deg, rgba(8,9,15,0.88) 0%, rgba(12,14,22,0.90) 50%, rgba(8,9,15,0.88) 100%)", // 透明度軽減でカード視認性向上
        // 控えめなテクスチャで品格演出
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.015) 1px, transparent 0)",
        backgroundSize: "32px 32px",
        backdropFilter: "blur(8px)", // カード視認性を保つため軽減
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
        <Box
          as="div"
          fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
          fontSize={{ base: "48px", md: "64px" }}
          fontWeight={600}
          letterSpacing="-0.02em"
          opacity={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={3}
          css={{
            color: success ? "rgba(255,255,255,0.95)" : "rgba(239,68,68,1)",
            textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            animation: "titleIn 600ms ease-out 200ms forwards",
          }}
        >
          <Box>{success ? "✨" : "💥"}</Box>
          <Box>{success ? "成功" : "失敗"}</Box>
          <Box>{success ? "✨" : "💥"}</Box>
        </Box>
        <Text
          mt={6}
          fontSize={{ base: "16px", md: "18px" }}
          letterSpacing="-0.01em"
          fontWeight={500}
          color="rgba(255,255,255,0.8)"
          opacity={0}
          css={{
            animation: "subIn 500ms ease-out 600ms forwards",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
          }}
        >
          {typeof correctCount === "number" && typeof totalCount === "number"
            ? `${correctCount}/${totalCount} 正解`
            : success
              ? "完璧な順序でクリア"
              : "うーん、今回は失敗。気楽にリトライしよう！"}
        </Text>
      </Box>
    </Box>
  );
}
