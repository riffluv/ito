"use client";
import WaitingAreaCard from "@/components/ui/WaitingAreaCard";
import type { PlayerDoc } from "@/lib/types";
import { DOCK_BOTTOM_DESKTOP, DOCK_BOTTOM_MOBILE } from "@/lib/ui/layout";
import { Box, Text } from "@chakra-ui/react";

export interface WaitingAreaProps {
  players: (PlayerDoc & { id: string })[];
  title?: string;
}

export default function WaitingArea({ players, title = "" }: WaitingAreaProps) {
  return (
    <Box
      position="fixed"
      left={{ base: 3, md: 6 }}
      right={{ base: 3, md: 6 }}
      bottom={{ base: DOCK_BOTTOM_MOBILE, md: DOCK_BOTTOM_DESKTOP }}
      zIndex={15}
      p={{ base: 3, md: 4 }}
      // 上品な控えめスタイル（AIテンプレ脱却）
      border="borders.retrogame"
      borderColor="rgba(255, 255, 255, 0.85)"
      borderRadius="lg"
      css={{
        // 控えめで上品な背景 - 可読性重視
        background: "rgba(12, 13, 16, 0.85)",
        // 微細なテクスチャは維持するが控えめに
        backgroundImage:
          "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.02) 1px, transparent 0)",
        backgroundSize: "20px 20px",
        backdropFilter: "blur(6px)",
        // 上品で控えめな影 - 人間らしい繊細さ
        boxShadow: 
          "0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {title && (
        <Text
          textAlign="center"
          fontWeight={600}
          fontSize={{ base: "13px", md: "14px" }}
          letterSpacing="0.5px"
          color="rgba(255,255,255,0.92)"
          mb={3}
          // メインメニューと同じ上品なフォント
          fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
          textShadow="0 1px 3px rgba(0,0,0,0.3)"
        >
          {title}
        </Text>
      )}

      <Box display="flex" gap={3} flexWrap="wrap" justifyContent="center">
        {players.map((p) => (
          <WaitingAreaCard key={p.id} player={p} />
        ))}
      </Box>

      <Box as="style">{`@keyframes pulseW{0%{opacity:.85}100%{opacity:1}}`}</Box>
    </Box>
  );
}
