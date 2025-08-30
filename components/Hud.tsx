"use client";
import {
  Badge,
  Box,
  HStack,
  IconButton,
  Progress,
  Spacer,
} from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { FiSettings, FiLogOut } from "react-icons/fi";

export type HudProps = {
  roomName: string;
  phase: "waiting" | "clue" | "playing" | "reveal" | "finished";
  activeCount?: number;
  totalCount?: number;
  remainMs?: number | null;
  totalMs?: number | null;
  hostPrimary?: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    title?: string;
  } | null;
  isHost?: boolean;
  onOpenSettings?: () => void;
  onLeaveRoom?: () => void | Promise<void>; // 退出ボタン用
};

export function Hud({
  roomName,
  phase,
  activeCount = 0,
  totalCount = 0,
  remainMs,
  totalMs,
  hostPrimary,
  isHost = false,
  onOpenSettings,
  onLeaveRoom,
}: HudProps) {
  const pct =
    totalMs && remainMs != null && totalMs > 0
      ? Math.max(0, Math.min(100, (remainMs / totalMs) * 100))
      : undefined;
  const phaseLabel = {
    waiting: "待機",
    clue: "入力",
    playing: "並べ替え",
    reveal: "公開",
    finished: "結果",
  }[phase];

  return (
    <Box
      w="100%"
      h={UNIFIED_LAYOUT.HEADER_HEIGHT} // メインメニューと同じ高さ
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      px={6}
      css={{
        // 125% DPI最適化
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          height: UNIFIED_LAYOUT.DPI_125.HEADER_HEIGHT,
        },
        // 150% DPI最適化
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
          height: UNIFIED_LAYOUT.DPI_150.HEADER_HEIGHT,
        },
      }}
    >
      {/* Game Title - Professional Style */}
      <Box
        fontSize="1.5rem"
        fontWeight={700}
        color="fgDefault"
        fontFamily="Inter, 'Noto Sans JP', ui-sans-serif, system-ui, -apple-system, sans-serif"
      >
        ITO
      </Box>
      
      {/* Room Info - Professional Style */}
      <Box
        display="flex"
        alignItems="center"
        gap={4}
      >
        <Box
          bg="panelSubBg"
          padding="0.5rem 0.75rem"
          borderRadius="0.5rem" // --radius-md
          fontFamily="'Monaco', monospace"
          fontSize="0.875rem"
          color="fgDefault"
          border="1px solid"
          borderColor="borderDefault"
        >
          {roomName}
        </Box>
        <Box
          bg="blue.500"
          color="white"
          padding="0.5rem 0.75rem"
          borderRadius="0.5rem" // --radius-md
          fontSize="0.875rem"
          fontWeight={500}
        >
          {phaseLabel}フェーズ
        </Box>
        
        {/* Leave Room Button - Professional Style */}
        {onLeaveRoom && (
          <IconButton
            aria-label="ルームを退出"
            onClick={onLeaveRoom}
            size="sm"
            colorPalette="red"
            variant="ghost"
            color="red.600"
            _hover={{
              bg: "red.50",
              color: "red.800",
            }}
            title="メインメニューに戻る"
          >
            <FiLogOut />
          </IconButton>
        )}
        
        {/* Settings Button - Professional Style */}
        {onOpenSettings && (
          <IconButton
            aria-label="設定"
            onClick={onOpenSettings}
            size="sm"
            colorPalette="gray"
            variant="ghost"
            color="gray.500"
            _hover={{
              bg: "gray.100",
              color: "gray.700",
            }}
          >
            <FiSettings />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
