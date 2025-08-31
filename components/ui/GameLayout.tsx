"use client";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { COSMIC_BACKGROUNDS } from "@/theme/premiumGameStyles";
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
  /** モック準拠の没入レイアウトを使用するか */
  variant?: "classic" | "immersive";
}

export function GameLayout({
  header,
  sidebar,
  main,
  rightPanel,
  handArea,
  variant = "classic",
}: GameLayoutProps) {
  // ゲーム画面でのみbodyスクロールを無効化
  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = ""; // クリーンアップ
    };
  }, []);

  // === 没入型（Artifact風）バリアント ===
  if (variant === "immersive") {
    // ヘッダーありなしで動的に高さを計算（125%DPI最適化）
    const headerHeight = header ? "70px" : "0px";
    const headerDPI125 = header ? "56px" : "0px"; // 125%DPI: 20%削減
    const headerDPI150 = header ? "48px" : "0px"; // 150%DPI: さらに削減
    
    return (
      <>
        <Box
          h="100dvh"
          position="relative"
          background={COSMIC_BACKGROUNDS.DEEP_SPACE}
          color="white"
          lineHeight={1.5}
          css={{ 
            WebkitFontSmoothing: "antialiased",
            // 動的パーティクル効果のベース
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `
                radial-gradient(2px 2px at 20px 30px, #ffffff, transparent),
                radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
                radial-gradient(1px 1px at 90px 40px, #ffffff, transparent),
                radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
                radial-gradient(2px 2px at 160px 30px, #ffffff, transparent)
              `,
              backgroundSize: "200px 100px",
              animation: "sparkle 15s linear infinite",
              pointerEvents: "none",
              zIndex: 1,
            },
            "@keyframes sparkle": {
              "0%": { transform: "translateY(0px)" },
              "100%": { transform: "translateY(-200px)" }
            }
          }}
        >
          {/* ヘッダー: ヘッダーがある場合のみレンダリング */}
          {header && (
            <Box
              position="fixed"
              top={0}
              left={0}
              right={0}
              height={headerHeight}
              zIndex={UNIFIED_LAYOUT.Z_INDEX.HEADER}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              px={{ base: 4, md: 6 }}
              css={{
                background:
                  "linear-gradient(180deg, rgba(101,67,33,0.9) 0%, rgba(101,67,33,0.7) 50%, rgba(101,67,33,0.3) 100%)",
                backdropFilter: "blur(15px)",
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  height: headerDPI125,
                },
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                  height: headerDPI150,
                },
              }}
            >
              {header}
            </Box>
          )}

          {/* メイン（全幅・境界なし）- ヘッダー有無で動的top調整 */}
          <Box
            position="absolute"
            top={headerHeight}
            left={0}
            right={0}
            bottom={0}
            overflow="hidden"
            display="flex"
            flexDirection="column"
            alignItems="center"
            css={{
              [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                top: headerDPI125,
              },
              [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                top: headerDPI150,
              },
            }}
          >
            <Box 
              w="100%" 
              h="100%" 
              px={{ base: 3, md: 6 }} 
              py={{ base: 3, md: 6 }}
              position="relative"
              zIndex={2}
            >
              {main}
            </Box>
          </Box>

          {/* ボトム操作/手札（浮遊・半透明） */}
          <Box
            position="fixed"
            left={{ base: 3, md: 6 }}
            right={{ base: 3, md: 6 }}
            bottom={{ base: 6, md: 8 }}
            zIndex={UNIFIED_LAYOUT.Z_INDEX.PANEL}
            borderRadius="16px"
            p={{ base: 2, md: 3 }}
            css={{
              background:
                "linear-gradient(180deg, rgba(101,67,33,0.8) 0%, rgba(80,53,26,0.9) 100%)",
              border: "2px solid rgba(160,133,91,0.6)",
              backdropFilter: "blur(15px)",
              boxShadow: "0 8px 25px rgba(0,0,0,0.6), inset 0 1px 0 rgba(160,133,91,0.3)",
            }}
          >
            {handArea || <Box h="1px" />}
          </Box>
        </Box>

        {/* モバイル: 必要なら従来のボトムシートを継続使用（非表示でも可） */}
        <Box display="none">
          <MobileBottomSheet chatPanel={rightPanel} sidebar={sidebar} rightPanel={rightPanel} />
        </Box>
      </>
    );
  }

  // === 既存（クラシック）バリアント ===
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
          xl: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.HAND_AREA_HEIGHT}`,
        }}
        gap={0}
        bg="canvasBg"
        fontFamily="Inter, 'Noto Sans JP', ui-sans-serif, system-ui, -apple-system, sans-serif"
        color="fgDefault"
        lineHeight={1.5}
        css={{
          WebkitFontSmoothing: "antialiased",
          "@media (max-width: 1279px)": {
            gridTemplateAreas: `"header" "main-area" "hand"`,
            gridTemplateColumns: "1fr",
            gridTemplateRows: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.HAND_AREA_HEIGHT}`,
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            gridTemplateRows: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.DPI_125.HAND_AREA_HEIGHT}`,
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
            gridTemplateRows: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.DPI_150.HAND_AREA_HEIGHT}`,
          },
        }}
      >
        <Box gridArea="header" bg="white" borderBottom="1px solid" borderColor="borderDefault" display="flex" boxShadow="0 1px 3px 0 rgb(0 0 0 / 0.1)">
          {header}
        </Box>

        {sidebar && (
          <Box gridArea="sidebar" bg="white" borderRight="1px solid" borderColor="borderDefault" overflowY="auto" display={{ base: "none", xl: "block" }}>
            {sidebar}
          </Box>
        )}

        <Box
          gridArea="main-area"
          bg="white"
          paddingInline={{ base: 3, md: 4, lg: 6, xl: 8 }}
          paddingTop={{ base: 3, md: 4, lg: 6, xl: 8 }}
          paddingBottom={0}
          overflowY="hidden"
          display="flex"
          flexDirection="column"
          position="relative"
          minH={0}
        >
          {main}
        </Box>

        {rightPanel && (
          <Box gridArea="chat" bg="white" borderLeft="1px solid" borderColor="borderDefault" display={{ base: "none", xl: "flex" }} flexDirection="column">
            {rightPanel}
          </Box>
        )}

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
          height={UNIFIED_LAYOUT.HAND_AREA_HEIGHT}
          maxHeight="none"
          css={{
            "@media (max-width: 768px)": { flexDirection: "column", gap: "1rem" },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: { height: UNIFIED_LAYOUT.DPI_125.HAND_AREA_HEIGHT },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: { height: UNIFIED_LAYOUT.DPI_150.HAND_AREA_HEIGHT },
          }}
        >
          {handArea || <Box h="1px" w="100%" />}
        </Box>
      </Box>

      <Box display={{ base: "block", md: "none" }}>
        <MobileBottomSheet chatPanel={rightPanel} sidebar={sidebar} rightPanel={rightPanel} />
      </Box>
    </>
  );
}

export default GameLayout;
