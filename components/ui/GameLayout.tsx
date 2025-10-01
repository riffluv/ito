"use client";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import React, { ReactNode, lazy, Suspense } from "react";
import MobileBottomSheet from "./MobileBottomSheet";
// ⚡ PERFORMANCE: Three.js を遅延ロード
const ThreeBackground = lazy(() =>
  import("./ThreeBackground").then((mod) => ({ default: mod.ThreeBackground }))
);

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
        {/* Three.js 3D背景 */}
        <Suspense fallback={null}>
          <ThreeBackground />
        </Suspense>

        <Box
          h="100dvh"
          position="relative"
          color="fgDefault"
          lineHeight={1.5}
          className="game-layout-immersive"
          css={{
            WebkitFontSmoothing: "antialiased",
            // 背景を透明にしてHD-2D背景を表示
            "&.game-layout-immersive": {
              backgroundColor: "transparent",
            },
          }}
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
              "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                {
                  top: headerDPI150,
                },
            }}
            >
              <Box
                w="100%"
                h="100%"
                px={{ base: 4, md: 8 }}
                py={{ base: 3, md: 5 }} // 縦パディング縮小でタイトな感じに
                position="relative"
                display="flex"
                flexDirection="column"
                gap={{ base: 3, md: 4 }} // gap縮小で要素間を詰める
                css={{
                  // DPI 150%対応：更なるコンパクト化
                  "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                    {
                      padding: "0.4rem 1.2rem !important", // パディング縮小
                      gap: "0.6rem !important", // 要素間を更に詰める
                    },
                }}
                zIndex={10}
                bg="transparent"
              >
                {main}
              </Box>
          </Box>

          {/* 左レール（なかま） */}
          {sidebar && (
            <Box
              position="fixed"
              top={{ base: "80px", md: "100px" }}
              // フッター（手札エリア）と重ならないように一定の下マージンを確保
              bottom={`calc(${UNIFIED_LAYOUT.HAND_AREA_HEIGHT} + 16px)`}
              // チャットと同じように左端に寄せて衝突を完全回避
              left={{ base: "12px", md: "16px" }}
              width={{ base: "220px", md: "240px" }}
              zIndex={UNIFIED_LAYOUT.Z_INDEX.PANEL}
              css={{ pointerEvents: "none" }}
            >
              <Box h="100%" pointerEvents="auto" overflowY="auto">
                {sidebar}
              </Box>
            </Box>
          )}

          {/* 右レール（チャット） */}
          {rightPanel && (
            <Box
              position="fixed"
              top={{ base: `calc(${headerHeight} + 8px)`, md: `calc(${headerHeight} + 12px)` }}
              // 高さを抑える：フッターよりかなり上で止める（DPIでも衝突回避）
              bottom={{ base: "clamp(220px, 28dvh, 360px)", md: "clamp(240px, 26dvh, 380px)" }}
              // さらに画面の外側（右端）へ寄せる
              right={{ base: "12px", md: "16px" }}
              width={{ base: "min(88vw, 320px)", md: "300px" }}
              zIndex={UNIFIED_LAYOUT.Z_INDEX.PANEL}
              css={{
                pointerEvents: "none",
                // 追加の安全装置: 最大高さをさらに制限
                maxHeight: "min(70dvh, 720px)",
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  bottom: "clamp(260px, 30dvh, 420px)",
                  maxHeight: "min(64dvh, 640px)",
                },
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                  bottom: "clamp(300px, 34dvh, 480px)",
                  maxHeight: "min(60dvh, 580px)",
                },
              }}
            >
              <Box h="100%" pointerEvents="auto" overflow="hidden">
                {rightPanel}
              </Box>
            </Box>
          )}

          <Box
            position="fixed"
            left={0}
            right={0}
            bottom={{ base: 4, md: 6 }}
            zIndex={UNIFIED_LAYOUT.Z_INDEX.PANEL}
            p={0}
            display="flex"
            justifyContent="center"
            px={{ base: 4, md: 8 }}
          >
            <Box w="100%" maxW="1440px">
              {handArea || <Box h="1px" />}
            </Box>
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
        gridTemplateColumns={{ base: "1fr", xl: "240px 1fr 280px" }} // ガイドライン: 軽い非対称 (240px != 280px)
        gridTemplateRows={{
          base: "auto minmax(0, 1fr) auto",
          xl: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.HAND_AREA_HEIGHT}`,
        }}
        gap={0}
        fontFamily="Inter, 'Noto Sans JP', ui-sans-serif, system-ui, -apple-system, sans-serif"
        color={UI_TOKENS.COLORS.textBase}
        lineHeight={1.5}
        css={{
          WebkitFontSmoothing: "antialiased",
          backgroundColor: "var(--chakra-colors-bg-canvas)",
          [`@media ${UNIFIED_LAYOUT.BREAKPOINTS.LG_DOWN}`]: {
            gridTemplateAreas: `"header" "main-area" "hand"`,
            gridTemplateColumns: "1fr",
            gridTemplateRows: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.HAND_AREA_HEIGHT}`,
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            gridTemplateRows: `auto minmax(0, 1fr) ${UNIFIED_LAYOUT.DPI_125.HAND_AREA_HEIGHT}`,
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
            // 150%DPI時の縦詰めを大幅強化（手札エリア大幅圧縮でカード重なり完全防止）
            gridTemplateRows: `auto minmax(0, 1fr) clamp(110px, 9dvh, 140px)`,
          },
        }}
      >
        <Box
          gridArea="header"
          bg={UI_TOKENS.COLORS.panelBg}
          borderBottomWidth="1px"
          borderColor={UI_TOKENS.COLORS.whiteAlpha30}
          display="flex"
          alignItems="center"
          px={{ base: 4, md: 8 }}
          boxShadow={`0 1px 0 ${UI_TOKENS.COLORS.whiteAlpha05}`}
        >
          {header}
        </Box>

        {sidebar && (
          <Box
            gridArea="sidebar"
            bg={UI_TOKENS.COLORS.panelBg}
            borderRightWidth="1px"
            borderColor={UI_TOKENS.COLORS.whiteAlpha30}
            overflowY="auto"
            display={{ base: "none", xl: "block" }}
          >
            {sidebar}
          </Box>
        )}

        <Box
          gridArea="main-area"
          bg={UI_TOKENS.COLORS.panelBg}
          paddingInline={{ base: 4, md: 6, lg: 8, xl: 7 }} // ガイドライン: 左右非対称 (7 != 8)
          paddingTop={{ base: 4, md: 6, lg: 8, xl: 7 }}
          paddingBottom={0}
          overflowY="hidden"
          display="flex"
          flexDirection="column"
          position="relative"
          minH={0}
          gap={{ base: 4, md: 5 }} // ガイドライン: リズム感 (5 != 6)
        >
          {main}
        </Box>

        {rightPanel && (
          <Box
            gridArea="chat"
            bg={UI_TOKENS.COLORS.panelBg}
            borderLeftWidth="1px"
            borderColor={UI_TOKENS.COLORS.whiteAlpha30}
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
            [`@media ${UNIFIED_LAYOUT.BREAKPOINTS.MOBILE}`]: {
              flexDirection: "column",
              gap: "1rem",
            },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              height: UNIFIED_LAYOUT.DPI_125.HAND_AREA_HEIGHT,
            },
            "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
              {
                height: "clamp(140px, 12dvh, 180px) !important", // 更にコンパクト
                padding: "0.6rem 0.8rem !important", // パディング縮小
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
