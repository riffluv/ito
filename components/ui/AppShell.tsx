"use client";
import { Box, SystemStyleObject } from "@chakra-ui/react";
import { ReactNode } from "react";

/**
 * AppShell: ルーム画面などフルビューポートを使うページの共通グリッドレイアウト。
 * - コンテナクエリ / ブレークポイントで列を再構成
 * - スロット: header / left / center / right / hand
 * - right は base で非表示 (md 以上で表示) が一般ケース
 */
export type AppShellProps = {
  header: ReactNode;
  left?: ReactNode;
  center: ReactNode;
  right?: ReactNode;
  hand?: ReactNode;
  /** 追加の grid カスタム (最小限) */
  gridSxOverride?: SystemStyleObject;
};

export function AppShell({
  header,
  left,
  center,
  right,
  hand,
  gridSxOverride,
}: AppShellProps) {
  return (
    <Box
      /* Full viewport height; allow slight expansion for DPI rounding */
      minH="100dvh"
      display="grid"
      className="room-grid" /* (container query styles removed in globals.css) */
      /* 固定 56px 行は fluid clamp フォント + Windows DPI でオーバーフローし内部スクロールを誘発 → auto 化 */
      gridTemplateRows={{ base: "auto 1fr auto", md: "auto 1fr minmax(140px,160px)" }}
      gridTemplateColumns={{ base: "1fr", md: "280px 1fr 340px" }}
      gridTemplateAreas={{
        base: `'header' 'center' 'hand'`,
        md: `'header header header' 'left center right' 'hand hand hand'`,
      }}
      gap={{ base: 2, md: 3 }}
      px={{ base: 2, md: 3 }}
      py={{ base: 2, md: 3 }}
      overflow="hidden"
      css={gridSxOverride as any}
    >
      <Box
        gridArea="header"
        display="flex"
        flexDir="column"
        gap={2}
        /* header intrinsic height */
        overflow="visible"
        as="header"
        role="banner"
      >
        {header}
      </Box>
      {left && (
        <Box
          gridArea="left"
          minH={0}
          overflow="hidden"
          display={{ base: "none", md: "block" }}
          as="nav"
          aria-label="Sidebar navigation"
        >
          {left}
        </Box>
      )}
      <Box
        gridArea="center"
        minH={0}
        display="flex"
        flexDir="column"
        gap={2}
        overflow="hidden"
        as="main"
        role="main"
      >
        {center}
      </Box>
      {right && (
        <Box
          gridArea="right"
          minH={0}
          display={{ base: "none", md: "block" }}
          overflow="hidden"
          as="aside"
          aria-label="Secondary panel"
        >
          {right}
        </Box>
      )}
      {hand && (
        <Box
          gridArea="hand"
          borderTopWidth="1px"
          borderColor="borderDefault"
          py={2}
          display="flex"
          flexDir="row"
          alignItems="center"
          gap={4}
          overflow="hidden"
          minH={0}
          as="section"
          aria-label="Hand actions"
        >
          {hand}
        </Box>
      )}
    </Box>
  );
}

export default AppShell;
