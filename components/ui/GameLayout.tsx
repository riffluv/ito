"use client";
import { DPI_ADAPTIVE_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { ReactNode } from "react";

/**
 * GameLayout: 予測可能で安定したゲーム画面レイアウト
 * 2025年DPIスケールベストプラクティス対応
 *
 * 設計原則:
 * - 流動的サイズ + 計算可能な制約
 * - 125% DPI スケールでの最適化
 * - 明確なスクロール境界
 * - agentが正確に予測できる構造
 * - スクロール発生の完全防止
 */
export interface GameLayoutProps {
  /** ヘッダー: 流動的高さ clamp(48px, 4vh, 64px) */
  header: ReactNode;
  /** 左サイドバー: 流動的幅 clamp(240px, 22vw, 300px) */
  sidebar?: ReactNode;
  /** 中央メインエリア: 残り幅、フレキシブル */
  main: ReactNode;
  /** 右パネル: 流動的幅 clamp(280px, 26vw, 360px) */
  rightPanel?: ReactNode;
  /** 手札エリア: 流動的高さ clamp(120px, 15vh, 180px) */
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
      // 2025年DPIスケール対応のCSSCustomPropertiesを設定
      css={{
        "--header-height": DPI_ADAPTIVE_LAYOUT.HEADER_HEIGHT_FLUID,
        "--sidebar-width": DPI_ADAPTIVE_LAYOUT.SIDEBAR_WIDTH_FLUID,
        "--right-panel-width": DPI_ADAPTIVE_LAYOUT.RIGHT_PANEL_WIDTH_FLUID,
        "--hand-min-height": DPI_ADAPTIVE_LAYOUT.HAND_MIN_HEIGHT_FLUID,

        // 125% DPIスケール最適化
        [`@media ${DPI_ADAPTIVE_LAYOUT.DPI_SCALE_125}`]: {
          "--header-height": "clamp(44px, 3.5vh, 58px)",
          "--hand-min-height": "clamp(75px, 7vh, 110px)", // 更に小さく
        },
      }}
    >
      {/* ヘッダー: 流動的高さ */}
      <Box
        flex="0 0 auto"
        h="var(--header-height)"
        borderBottomWidth="1px"
        borderColor="borderDefault"
        bg="panelBg"
        px={4}
        py={3}
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
            w="var(--sidebar-width)"
            flex="0 0 var(--sidebar-width)"
            borderRightWidth="1px"
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
            w="var(--right-panel-width)"
            flex="0 0 var(--right-panel-width)"
            borderLeftWidth="1px"
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

      {/* 手札エリア: 流動的高さ */}
      {handArea && (
        <Box
          flex="0 0 auto"
          borderTopWidth="1px"
          borderColor="borderDefault"
          bg="panelBg"
          px={4}
          py={4}
          minH="var(--hand-min-height)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={4}
          boxShadow="elevated"
        >
          {handArea}
        </Box>
      )}
    </Box>
  );
}

export default GameLayout;
