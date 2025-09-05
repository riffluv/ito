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
    // ヘッダー高さ (DPIバリアント)
    const headerHeight = header ? "64px" : "0px";
    const headerDPI125 = header ? "56px" : "0px";
    const headerDPI150 = header ? "48px" : "0px";

    return (
      <>
        <Box
          h="100dvh"
          position="relative"
          bg="canvasBg"
          color="fgDefault"
          lineHeight={1.5}
          css={{ WebkitFontSmoothing: "antialiased" }}
        >
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
              px={{ base: 4, md: 8 }}
              bg="surfaceSubtle"
              borderBottomWidth="1px"
              borderColor="borderDefault"
              backdropFilter="blur(12px) saturate(1.2)"
              css={{
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
              containerType: "inline-size",
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
              px={{ base: 4, md: 8 }}
              py={{ base: 4, md: 8 }}
              position="relative"
              display="flex"
              flexDirection="column"
              gap={{ base: 4, md: 6 }}
              zIndex={1}
            >
              {main}
            </Box>
          </Box>

          <Box
            position="fixed"
            left={{ base: 4, md: 8 }}
            right={{ base: 4, md: 8 }}
            bottom={{ base: 6, md: 8 }}
            zIndex={UNIFIED_LAYOUT.Z_INDEX.PANEL}
            borderRadius={0}
            p={{ base: 3, md: 4 }}
            bg="#000"
            borderWidth="0"
            backdropFilter="none"
            boxShadow="none"
            border="borders.retrogame"
            borderColor="#fff"
          >
            {handArea || <Box h="1px" />}
          </Box>
        </Box>

        <Box display="none">
          <MobileBottomSheet
            chatPanel={rightPanel}
            sidebar={sidebar}
            rightPanel={rightPanel}
          />
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
        <Box
          gridArea="header"
          bg="surfaceSubtle"
          borderBottomWidth="1px"
          borderColor="borderDefault"
          display="flex"
          alignItems="center"
          px={{ base: 4, md: 8 }}
          boxShadow="0 1px 0 rgba(255,255,255,0.05)"
        >
          {header}
        </Box>

        {sidebar && (
          <Box
            gridArea="sidebar"
            bg="surfaceRaised"
            borderRightWidth="1px"
            borderColor="borderDefault"
            overflowY="auto"
            display={{ base: "none", xl: "block" }}
          >
            {sidebar}
          </Box>
        )}

        <Box
          gridArea="main-area"
          bg="surfaceRaised"
          paddingInline={{ base: 4, md: 6, lg: 8, xl: 8 }}
          paddingTop={{ base: 4, md: 6, lg: 8, xl: 8 }}
          paddingBottom={0}
          overflowY="hidden"
          display="flex"
          flexDirection="column"
          position="relative"
          minH={0}
          gap={{ base: 4, md: 6 }}
        >
          {main}
        </Box>

        {rightPanel && (
          <Box
            gridArea="chat"
            bg="surfaceRaised"
            borderLeftWidth="1px"
            borderColor="borderDefault"
            display={{ base: "none", xl: "flex" }}
            flexDirection="column"
          >
            {rightPanel}
          </Box>
        )}

        <Box
          gridArea="hand"
          bg="transparent"
          padding={{ base: 4, md: 6 }}
          display="flex"
          alignItems="center"
          justifyContent="center"
          height={UNIFIED_LAYOUT.HAND_AREA_HEIGHT}
          maxHeight="none"
          gap={{ base: 3, md: 4 }}
          css={{
            "@media (max-width: 768px)": {
              flexDirection: "column",
              gap: "1rem",
            },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              height: UNIFIED_LAYOUT.DPI_125.HAND_AREA_HEIGHT,
            },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
              height: UNIFIED_LAYOUT.DPI_150.HAND_AREA_HEIGHT,
            },
          }}
        >
          {handArea || <Box h="1px" w="100%" />}
        </Box>
      </Box>

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
