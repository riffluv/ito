"use client";
import WaitingAreaCard from "@/components/ui/WaitingAreaCard";
import type { PlayerDoc } from "@/lib/types";
import { DOCK_BOTTOM_DESKTOP, DOCK_BOTTOM_MOBILE } from "@/lib/ui/layout";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import { Box, Text, VStack } from "@chakra-ui/react";

export interface WaitingAreaProps {
  players: (PlayerDoc & { id: string })[];
  title?: string;
  isDraggingEnabled?: boolean; // ドラッグ機能有効化フラグ
  meId?: string; // 自分のID（本人のみドラッグ可能にする）
  displayMode?: "full" | "minimal"; // カード表示モード
}

export default function WaitingArea({
  players,
  title = "",
  isDraggingEnabled = false,
  meId,
  displayMode = "full",
}: WaitingAreaProps) {
  return (
    <VStack
      width="100%"
      maxWidth="600px"
      mx="auto"
      mt={{ base: 4, md: 6 }}
      p={{ base: 3, md: 4 }}
      gap={4}
      // 上品な控えめスタイル（AIテンプレ脱却）
      // borderなし - 透明背景でクリーンな表示
      borderRadius="lg"
      css={{
        // 背景なしでクリーンな表示
        background: "transparent",
        // シャドウも最小限に（ボーダーが主役）
        boxShadow: "none",
        // 150DPI専用: WaitingArea自体を圧縮
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
          marginTop: "0.5rem !important",
          padding: "0.5rem !important",
        },
      }}
    >
      {title && (
        <Text
          textAlign="center"
          fontWeight={600}
          fontSize={{ base: "13px", md: "14px" }}
          letterSpacing="0.5px"
          color={UI_TOKENS.COLORS.whiteAlpha95}
          mb={3}
          // メインメニューと同じ上品なフォント
          fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
          textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
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
          // DPI 150%対応：空きスロットと統一
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
            {
              gap: "12px !important", // 空きスロットと同じ間隔
            },
        }}
      >
        {/* エキスパートモード: 自分のカードのみ表示 */}
        {displayMode === "minimal" 
          ? players.filter(p => p.id === meId).map((p) => (
              <WaitingAreaCard
                key={p.id}
                player={p}
                isDraggingEnabled={isDraggingEnabled}
                meId={meId}
              />
            ))
          : players.map((p) => (
              <WaitingAreaCard
                key={p.id}
                player={p}
                isDraggingEnabled={isDraggingEnabled}
                meId={meId}
              />
            ))
        }
      </Box>


      <Box as="style">{`@keyframes pulseW{0%{opacity:.85}100%{opacity:1}}`}</Box>
    </VStack>
  );
}
