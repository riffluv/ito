"use client";
import { AppIconButton } from "@/components/ui/AppIconButton";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import { SAFE_AREA_INSET } from "@/lib/ui/layout";
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
      // 16:9 安全領域対応：左右にインセットを適用
      px={{ base: SAFE_AREA_INSET.MOBILE, md: SAFE_AREA_INSET.DESKTOP }}
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

      {/* Room Info - DQ Style ガイドライン準拠 */}
      <Box
        display="flex"
        alignItems="center"
        gap={{ base: 3, md: 5 }} // ガイドライン: リズム感 (3 != 5)
        // 16:9 安全領域対応：右シフトを削除（px で既に内側に配置済み）
      >
        <Box
          bg="bgPanel" // obsidian.800 - ガイドライン準拠
          px={3} py={2} // tokens経由: 6px, 4px
          borderRadius="sm" // レトロ: 4px
          fontFamily="mono" // DQ風等幅フォント
          fontSize="sm" // tokens: 14px
          color="textPrimary" // obsidian.50
          border="1px solid"
          borderColor="borderDefault" // 12% 可視性
          boxShadow="px1" // ピクセル風影
          textShadow="1px 1px 0 rgba(0,0,0,0.7)" // ピクセル風縁取り
        >
          {roomName}
        </Box>
        <Box
          bg="accentSubtle" // slimeBlue @ 10%
          color="textPrimary" // obsidian.50
          px={3} py={2} // tokens経由: 6px, 4px
          borderRadius="sm" // レトロ: 4px
          fontSize="sm" // tokens: 14px
          fontWeight="semibold" // tokens経由
          border="1px solid"
          borderColor="accent" // slimeBlue.500
          boxShadow="px2" // ピクセル風段積み影
          textShadow="1px 1px 0 rgba(0,0,0,0.7)" // ピクセル風縁取り
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
