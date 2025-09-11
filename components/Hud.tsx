"use client";
import { AppIconButton } from "@/components/ui/AppIconButton";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { FiLogOut, FiSettings } from "react-icons/fi";

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
      bg={UI_TOKENS.COLORS.panelBg}
      borderBottom={`2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
      backdropFilter="blur(8px)"
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
      {/* Game Title - Dragon Quest Style */}
      <Box
        fontSize="1.5rem"
        fontWeight={700}
        color={UI_TOKENS.COLORS.textBase}
        fontFamily="Inter, 'Noto Sans JP', ui-sans-serif, system-ui, -apple-system, sans-serif"
        textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
      >
        序の紋章III
      </Box>

      {/* Room Info - Dragon Quest Style */}
      <Box display="flex" alignItems="center" gap={4}>
        <Box
          bg={UI_TOKENS.COLORS.panelBg}
          padding="0.5rem 0.75rem"
          borderRadius="6px"
          fontFamily="'Monaco', monospace"
          fontSize="0.875rem"
          color={UI_TOKENS.COLORS.whiteAlpha90}
          border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
          boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
          textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        >
          {roomName}
        </Box>
        <Box
          bg="rgba(74,158,255,0.3)"
          color={UI_TOKENS.COLORS.textBase}
          padding="0.5rem 0.75rem"
          borderRadius="6px"
          fontSize="0.875rem"
          fontWeight={600}
          border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
          boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
          textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        >
          {phaseLabel}フェーズ
        </Box>

        {/* Leave Room Button - Dragon Quest Style */}
        {onLeaveRoom && (
          <AppIconButton
            aria-label="ルームを退出"
            onClick={onLeaveRoom}
            size="sm"
            visual="solid"
            palette="brand"
            title="メインメニューに戻る"
          >
            <FiLogOut />
          </AppIconButton>
        )}

        {/* Settings Button - Dragon Quest Style */}
        {onOpenSettings && (
          <AppIconButton
            aria-label="設定"
            onClick={onOpenSettings}
            size="sm"
            visual="outline"
            palette="gray"
          >
            <FiSettings />
          </AppIconButton>
        )}
      </Box>
    </Box>
  );
}
