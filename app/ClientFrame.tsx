"use client";
import PerfStatsOverlay from "@/components/dev/PerfStatsOverlay";
import Header from "@/components/site/Header";
import { usePathname } from "next/navigation";
import React from "react";

// クライアント側でのみ実行されるラッパー。
// /rooms/ 配下ではグローバル Header を非表示にしフルスクリーン AppShell を最大化。
// 注意: RPGPageTransitionは削除 - TransitionProviderシステムに統一
export function ClientFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showHeader = pathname === "/"; // ヘッダーはメインメニューのみ
  return (
    <>
      {showHeader && <Header />}
      <main id="main" role="main">{children}</main>
      <PerfStatsOverlay />
    </>
  );
}
export default ClientFrame;
