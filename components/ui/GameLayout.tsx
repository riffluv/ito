"use client";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { ReactNode } from "react";
import MobileBottomSheet from "./MobileBottomSheet";

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
    <>
      <Box
        h="100dvh"
        display="grid"
        gridTemplateAreas={`
          "header header header"
          "sidebar main-area chat"
          "hand hand hand"
        `}
        gridTemplateColumns={{ base: "1fr", xl: "280px 1fr 320px" }}
        gridTemplateRows={{ base: "auto 1fr auto", xl: "auto 1fr 160px" }}
        gap="1px"
        bg="#f8fafc" // --slate-50
        fontFamily="Inter, 'Noto Sans JP', ui-sans-serif, system-ui, -apple-system, sans-serif"
        color="#0f172a" // --slate-900
        lineHeight={1.5}
        css={{
          "-webkit-font-smoothing": "antialiased",
          // レスポンシブ対応: モバイルでは縦積み
          "@media (max-width: 1279px)": {
            gridTemplateAreas: `
              "header"
              "main-area"
              "hand"
            `,
            gridTemplateColumns: "1fr",
            gridTemplateRows: "auto minmax(0, 1fr) minmax(140px, auto)",
          },
        }}
      >
        {/* ヘッダー: Professional Game Header - メインメニューと同じ高さ */}
        <Box
          gridArea="header"
          bg="white"
          borderBottom="1px solid #e2e8f0" // --slate-200
          padding="0.75rem 1.5rem"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          boxShadow="0 1px 3px 0 rgb(0 0 0 / 0.1)"
          minHeight="56px"
        >
          {header}
        </Box>

        {/* 左サイドバー - Professional Sidebar */}
        {sidebar && (
          <Box
            gridArea="sidebar"
            bg="white"
            borderRight="1px solid #e2e8f0" // --slate-200
            overflowY="auto"
            display={{ base: "none", xl: "block" }}
          >
            {sidebar}
          </Box>
        )}

        {/* 中央メインエリア - Professional Main Area */}
        <Box
          gridArea="main-area"
          bg="white"
          padding={{ base: "1rem", md: "2rem" }}
          overflow="hidden" // 根本解決: Grid子要素の適切なoverflow制御
          display="flex"
          flexDirection="column"
          position="relative" // Grid子要素の適切な配置コンテキスト
        >
          {main}
        </Box>

        {/* 右パネル - Professional Chat Panel */}
        {rightPanel && (
          <Box
            gridArea="chat"
            bg="white"
            borderLeft="1px solid #e2e8f0" // --slate-200
            display={{ base: "none", xl: "flex" }}
            flexDirection="column"
          >
            {rightPanel}
          </Box>
        )}

        {/* 手札エリア - Professional Hand Panel */}
        <Box
          gridArea="hand"
          bg="white"
          borderTop="1px solid #e2e8f0" // --slate-200
          padding={{ base: "1rem", md: "1.5rem" }}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={{ base: "1rem", md: "2rem" }}
          boxShadow="0 -1px 3px 0 rgb(0 0 0 / 0.1)"
          minHeight={{ base: "140px", md: "160px" }}
          maxHeight={{ base: "180px", md: "200px" }}
          css={{
            "@media (max-width: 768px)": {
              flexDirection: "column",
              gap: "1rem",
            },
          }}
        >
          {handArea || (
            <Box h="1px" w="100%" /> // 空の場合のプレースホルダー
          )}
        </Box>
      </Box>

      {/* モバイル専用ボトムシート - モバイルのみ表示 */}
      <Box display={{ base: "block", md: "none" }}>
        <MobileBottomSheet
          chatPanel={rightPanel}
          sidebar={sidebar}
          rightPanel={rightPanel}
        />
      </Box>
    </>
  );
}

export default GameLayout;
