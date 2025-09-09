"use client";
import WaitingAreaCard from "@/components/ui/WaitingAreaCard";
import type { PlayerDoc } from "@/lib/types";
import { DOCK_BOTTOM_DESKTOP, DOCK_BOTTOM_MOBILE } from "@/lib/ui/layout";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";

export interface WaitingAreaProps {
  players: (PlayerDoc & { id: string })[];
  title?: string;
  isDraggingEnabled?: boolean; // ドラッグ機能有効化フラグ
}

export default function WaitingArea({ 
  players, 
  title = "",
  isDraggingEnabled = false 
}: WaitingAreaProps) {
  return (
    <Box
      position="fixed"
      left={{ base: 3, md: 6 }}
      right={{ base: 3, md: 6 }}
      bottom={{ base: DOCK_BOTTOM_MOBILE, md: DOCK_BOTTOM_DESKTOP }}
      zIndex={UNIFIED_LAYOUT.Z_INDEX.PANEL}
      p={{ base: 3, md: 4 }}
      // 上品な控えめスタイル（AIテンプレ脱却）
      border="borders.retrogame"
      borderColor="rgba(255, 255, 255, 0.85)"
      borderRadius="lg"
      css={{
        // 背景なしでクリーンな表示
        background: "transparent",
        // シャドウも最小限に（ボーダーが主役）
        boxShadow: "none",
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

      <Box 
        display="flex" 
        gap={UNIFIED_LAYOUT.SPACING.CARD_GAP} 
        flexWrap="wrap" 
        justifyContent="center"
        css={{
          // DPI125%での最適化
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            gap: "8px",
          },
          // DPI 150%対応：待機エリアの最適化
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
            gap: "18px !important", // カード間隔を広く
          },
        }}
      >
        {players.map((p) => (
          <WaitingAreaCard 
            key={p.id} 
            player={p} 
            isDraggingEnabled={isDraggingEnabled}
          />
        ))}
      </Box>

      <Box as="style">{`@keyframes pulseW{0%{opacity:.85}100%{opacity:1}}`}</Box>
    </Box>
  );
}
