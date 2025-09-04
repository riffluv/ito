"use client";
import Header from "@/components/site/Header";
import { usePathname } from "next/navigation";
import React from "react";

// クライアント側でのみ実行されるラッパー。
// /rooms/ 配下ではグローバル Header を非表示にしフルスクリーン AppShell を最大化。
export function ClientFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showHeader = pathname === "/"; // ヘッダーはメインメニューのみ
  return (
    <>
      {showHeader && <Header />}
      <main id="main" role="main">{children}</main>
    </>
  );
}
export default ClientFrame;
