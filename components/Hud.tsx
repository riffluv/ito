"use client";
import {
  Badge,
  Box,
  HStack,
  IconButton,
  Progress,
  Spacer,
} from "@chakra-ui/react";
import { FiSettings } from "react-icons/fi";

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
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      px={6}
      py={4}
    >
      {/* Game Title - Professional Style */}
      <Box
        fontSize="1.5rem"
        fontWeight={700}
        color="#0f172a" // --slate-900
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
          bg="#f1f5f9" // --slate-100
          padding="0.5rem 0.75rem"
          borderRadius="0.5rem" // --radius-md
          fontFamily="'Monaco', monospace"
          fontSize="0.875rem"
          color="#334155" // --slate-700
          border="1px solid #e2e8f0" // --slate-200
        >
          {roomName}
        </Box>
        <Box
          bg="#0ea5e9" // --blue-500
          color="white"
          padding="0.5rem 0.75rem"
          borderRadius="0.5rem" // --radius-md
          fontSize="0.875rem"
          fontWeight={500}
        >
          {phaseLabel}フェーズ
        </Box>
        
        {/* Settings Button - Professional Style */}
        {onOpenSettings && (
          <IconButton
            aria-label="設定"
            onClick={onOpenSettings}
            size="sm"
            colorPalette="gray"
            variant="ghost"
            color="#64748b" // --slate-500
            _hover={{
              bg: "#f1f5f9", // --slate-100
              color: "#334155", // --slate-700
            }}
          >
            <FiSettings />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
