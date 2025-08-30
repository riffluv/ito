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
        background: "radial-gradient(ellipse at center, rgba(26,13,40,0.98) 0%, rgba(12,6,20,1) 100%)",
        animation: "fadeIn 300ms ease-out",
        "@keyframes fadeIn": { from: { opacity: 0 }, to: { opacity: 1 } },
        pointerEvents: "none",
      }}
      role="presentation"
      aria-label={success ? "結果: 成功" : "結果: 失敗"}
    >
      {/* 星屑 */}
      <Box
        position="absolute"
        inset={0}
        pointerEvents="none"
        css={{
          background:
            "radial-gradient(2px 2px at 100px 50px, rgba(255,255,255,0.8), transparent)," +
            "radial-gradient(1px 1px at 200px 120px, rgba(255,255,255,0.6), transparent)," +
            "radial-gradient(1px 1px at 300px 80px, rgba(147,112,219,0.7), transparent)," +
            "radial-gradient(2px 2px at 400px 160px, rgba(255,255,255,0.5), transparent)",
          animation: "twinkle 4s ease-in-out infinite alternate",
          "@keyframes twinkle": { from: { opacity: 0.7 }, to: { opacity: 1 } },
        }}
      />
      {/* 幾何学図形 */}
      <Box
        position="absolute"
        width="200px"
        height="200px"
        border="2px solid rgba(255, 215, 0, 0.8)"
        borderRadius="0"
        css={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) scale(0)",
          animation: "geomIn 2s ease-out 0.5s forwards",
        }}
        _before={{
          content: '""',
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "140px",
          height: "140px",
          border: "2px solid rgba(255, 215, 0, 0.6)",
          transform: "translate(-50%, -50%) rotate(0deg)",
          animation: "spinA 8s linear infinite",
        }}
        _after={{
          content: '""',
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "100px",
          height: "100px",
          border: "2px solid rgba(255, 215, 0, 0.4)",
          transform: "translate(-50%, -50%) rotate(60deg)",
          animation: "spinB 12s linear infinite reverse",
        }}
      />
      {/* Keyframes（ローカル注入） */}
      <Box as="style">{`
        @keyframes geomIn{0%{opacity:0;transform:translate(-50%,-50%) scale(0) rotate(0deg)}100%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(360deg)}}
        @keyframes spinA{0%{transform:translate(-50%,-50%) rotate(0deg)}100%{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes spinB{0%{transform:translate(-50%,-50%) rotate(60deg)}100%{transform:translate(-50%,-50%) rotate(420deg)}}
        @keyframes titleInS{0%{filter:blur(6px);opacity:0}100%{filter:blur(0);opacity:1}}
        @keyframes titleInF{0%{filter:blur(6px);opacity:0}100%{filter:blur(0);opacity:1}}
        @keyframes subIn{0%{opacity:0}100%{opacity:1}}
      `}</Box>

      {/* テキスト */}
      <Box textAlign="center" zIndex={10}>
        <Text
          fontFamily="Cinzel, serif"
          fontSize={{ base: "48px", md: "72px" }}
          fontWeight={300}
          letterSpacing="12px"
          opacity={0}
          css={{
            color: success ? "rgba(255,215,0,1)" : "rgba(220,53,69,1)",
            textShadow: success
              ? "0 0 20px rgba(255,215,0,0.8), 0 0 40px rgba(255,215,0,0.6), 2px 2px 4px rgba(0,0,0,0.9)"
              : "0 0 20px rgba(220,53,69,0.8), 0 0 40px rgba(220,53,69,0.6), 2px 2px 4px rgba(0,0,0,0.9)",
            animation: `${success ? "titleInS" : "titleInF"} 800ms ease-out 200ms forwards`,
          }}
        >
          {success ? "VICTORY" : "DEFEAT"}
        </Text>
        <Text
          mt={6}
          fontSize={{ base: "14px", md: "18px" }}
          letterSpacing="4px"
          color={success ? "rgba(255,215,0,0.8)" : "rgba(255,255,255,0.85)"}
          opacity={0}
          css={{ animation: "subIn 600ms ease-out 600ms forwards" }}
        >
          {typeof correctCount === "number" && typeof totalCount === "number"
            ? `${correctCount}/${totalCount} 正解`
            : "クリックで閉じる"}
        </Text>
      </Box>
    </Box>
  );
}
