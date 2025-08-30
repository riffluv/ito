"use client";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import React, { ReactNode } from "react";
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
  // ゲーム画面でのみbodyスクロールを無効化
  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = ""; // クリーンアップ
    };
  }, []);

  return (
    <>
      <Box
        h="100dvh" // 画面高を厳密固定（DPI125%でも溢れさせない）
        display="grid"
        gridTemplateAreas={`
          "header header header"
          "sidebar main-area chat"
          "hand hand hand"
        `}
        gridTemplateColumns={{ base: "1fr", xl: "280px 1fr 320px" }}
        gridTemplateRows={{ 
          base: "auto minmax(0, 1fr) auto", 
          xl: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.HAND_AREA_HEIGHT}`
        }}
        gap={0}
        bg="canvasBg"
        fontFamily="Inter, 'Noto Sans JP', ui-sans-serif, system-ui, -apple-system, sans-serif"
        color="fgDefault"
        lineHeight={1.5}
          css={{
            "WebkitFontSmoothing": "antialiased",
            // レスポンシブ対応: モバイルでは縦積み
            "@media (max-width: 1279px)": {
              gridTemplateAreas: `
              "header"
              "main-area"
              "hand"
            `,
              gridTemplateColumns: "1fr",
              gridTemplateRows: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.HAND_AREA_HEIGHT}`,
            },
            // DPI125% 小型ノートPC 特別対応 - 2025年ベストプラクティス
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              gridTemplateRows: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.DPI_125.HAND_AREA_HEIGHT}`,
              // height制約を除去しglobals.cssに一任
            },
            // DPI150% 特別対応
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
              gridTemplateRows: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.DPI_150.HAND_AREA_HEIGHT}`,
            },
          }}
        >
        {/* ヘッダー: Professional Game Header - メインメニューと統一 */}
        <Box
          gridArea="header"
          bg="white"
          borderBottom="1px solid"
          borderColor="borderDefault"
          display="flex"
          boxShadow="0 1px 3px 0 rgb(0 0 0 / 0.1)"
        >
          {header}
        </Box>

        {/* 左サイドバー - Professional Sidebar */}
        {sidebar && (
          <Box
            gridArea="sidebar"
            bg="white"
            borderRight="1px solid"
            borderColor="borderDefault"
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
          paddingInline={{ base: 3, md: 4, lg: 6, xl: 8 }}
          paddingTop={{ base: 3, md: 4, lg: 6, xl: 8 }}
          paddingBottom={0} // 下側の余白は中央コンテンツ側(ステータスドック)で管理
          overflowY="hidden" // 125%での細いスクロールを抑止（高さはDPI調整で吸収）
          display="flex"
          flexDirection="column"
          position="relative" // Grid子要素の適切な配置コンテキスト
          minH={0} // Grid内で高さ計算を正しく行う
        >
          {main}
        </Box>

        {/* 右パネル - Professional Chat Panel */}
        {rightPanel && (
          <Box
            gridArea="chat"
            bg="white"
            borderLeft="1px solid"
            borderColor="borderDefault"
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
          borderTop="1px solid"
          borderColor="borderDefault"
          padding={{ base: "1rem", md: "1.5rem" }}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={{ base: "1rem", md: "2rem" }}
          boxShadow="0 -1px 3px 0 rgb(0 0 0 / 0.1)"
          height={UNIFIED_LAYOUT.HAND_AREA_HEIGHT} // 基本値
          maxHeight="none"
          css={{
            "@media (max-width: 768px)": {
              flexDirection: "column",
              gap: "1rem",
            },
            // DPI125% で上書き
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              height: UNIFIED_LAYOUT.DPI_125.HAND_AREA_HEIGHT,
            },
            // DPI150% で上書き
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
              height: UNIFIED_LAYOUT.DPI_150.HAND_AREA_HEIGHT,
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
