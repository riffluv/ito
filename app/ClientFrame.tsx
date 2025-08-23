"use client";
import Header from "@/components/site/Header";
import { usePathname } from "next/navigation";
import React from "react";

// クライアント側でのみ実行されるラッパー。
// /rooms/ 配下ではグローバル Header を非表示にしフルスクリーン AppShell を最大化。
export function ClientFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideHeader = pathname?.startsWith("/rooms/");
  return (
    <>
      {!hideHeader && <Header />}
      <div id="main">{children}</div>
    </>
  );
}
export default ClientFrame;
