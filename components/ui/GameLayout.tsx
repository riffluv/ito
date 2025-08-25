"use client";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { ReactNode } from "react";

/**
 * GameLayout: 予測可能で安定したゲーム画面レイアウト
 * 2025年DPIスケールベストプラクティス対応
 *
 * 設計原則:
 * - 統一レイアウトシステムの使用
 * - 125% DPI スケールでの最適化
 * - 明確なスクロール境界
 * - agentが正確に予測できる構造
 * - スクロール発生の完全防止
 * - CSS設計の一貫性と保守性
 */
export interface GameLayoutProps {
  /** ヘッダー: 統一レイアウトシステムによる流動高さ */
  header: ReactNode;
  /** 左サイドバー: 統一レイアウトシステムによる流動幅 */
  sidebar?: ReactNode;
  /** 中央メインエリア: 残り幅、フレキシブル */
  main: ReactNode;
  /** 右パネル: 統一レイアウトシステムによる流動幅 */
  rightPanel?: ReactNode;
  /** 手札エリア: 統一レイアウトシステムによる流動高さ */
  handArea?: ReactNode;
}

export function GameLayout({
  header,
  sidebar,
  main,
  rightPanel,
  handArea,
}: GameLayoutProps) {
  return (
    <Box
      h="100dvh"
      display="flex"
      flexDir="column"
      bg="canvasBg"
      overflow="hidden"
      fontFamily="body"
      // 2025年DPIスケール対応のCSSCustomPropertiesを統一システムで設定
      css={{
        "--unified-header-height": UNIFIED_LAYOUT.HEADER_HEIGHT,
        "--unified-sidebar-width": UNIFIED_LAYOUT.SIDEBAR_WIDTH,
        "--unified-right-panel-width": UNIFIED_LAYOUT.RIGHT_PANEL_WIDTH,
        "--unified-hand-area-height": UNIFIED_LAYOUT.HAND_AREA_HEIGHT,

        // 125% DPIスケール最適化
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          "--unified-header-height": UNIFIED_LAYOUT.DPI_125.HEADER_HEIGHT,
          "--unified-hand-area-height": UNIFIED_LAYOUT.DPI_125.HAND_AREA_HEIGHT,
        },
      }}
    >
      {/* ヘッダー: 統一システムによる流動高さ */}
      <Box
        flex="0 0 auto"
        h="var(--unified-header-height)"
        borderBottomWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
        borderColor="borderDefault"
        bg="panelBg"
        px={0} /* パディング除去：外側で制御 */
        py={0} /* パディング除去：外側で制御 */
        display="flex"
        alignItems="center"
        boxShadow="interactive"
        // テキスト最適化
        css={{
          "-webkit-font-smoothing": "antialiased",
          "-moz-osx-font-smoothing": "grayscale",
          "text-rendering": "optimizeLegibility",
        }}
      >
        {header}
      </Box>

      {/* メインコンテンツエリア: 残り高さを使用 */}
      <Box flex="1 1 0" display="flex" minH={0}>
        {/* 左サイドバー */}
        {sidebar && (
          <Box
            w="var(--unified-sidebar-width)"
            flex="0 0 var(--unified-sidebar-width)"
            borderRightWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
            borderColor="borderDefault"
            bg="panelBg"
            display={{ base: "none", md: "flex" }}
            flexDir="column"
            overflow="hidden"
          >
            {sidebar}
          </Box>
        )}

        {/* 中央メインエリア: 残り幅を使用 */}
        <Box
          flex="1 1 0"
          display="flex"
          flexDir="column"
          minH={0}
          bg="canvasBg"
          overflow="hidden"
        >
          {main}
        </Box>

        {/* 右パネル */}
        {rightPanel && (
          <Box
            w="var(--unified-right-panel-width)"
            flex="0 0 var(--unified-right-panel-width)"
            borderLeftWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
            borderColor="borderDefault"
            bg="panelBg"
            display={{ base: "none", md: "flex" }}
            flexDir="column"
            overflow="hidden"
          >
            {rightPanel}
          </Box>
        )}
      </Box>

      {/* 手札エリア: 統一システムによる固定高さ - 常に表示 */}
      <Box
        flex="0 0 auto"
        h="var(--unified-hand-area-height)" // minHではなくhで固定高さ
        borderTopWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
        borderColor="borderDefault"
        bg="panelBg"
        px={0} /* パディング除去：外側で制御 */
        py={0} /* パディング除去：外側で制御 */
        display="flex"
        alignItems="center"
        justifyContent="center"
        gap={4}
        boxShadow="elevated"
        overflow="hidden" // コンテンツがはみ出ないように
      >
        {handArea || (
          <Box h="1px" w="100%" /> // 空の場合のプレースホルダー
        )}
      </Box>
    </Box>
  );
}

export default GameLayout;
