"use client";
import PerfStatsOverlay from "@/components/dev/PerfStatsOverlay";
import PerformanceMetricsInitializer from "@/components/perf/PerformanceMetricsInitializer";
import Header from "@/components/site/Header";
import { usePathname } from "next/navigation";
import React from "react";

// Client-only wrapper.
// Hides the global Header on /rooms/ routes to maximize the AppShell.
// TransitionProvider replaces the legacy RPGPageTransition.
export function ClientFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showHeader = pathname === "/"; // Header is visible only on the lobby
  return (
    <>
      <PerformanceMetricsInitializer />
      {showHeader && <Header />}
      <main id="main" role="main">{children}</main>
      <PerfStatsOverlay />
    </>
  );
}
export default ClientFrame;
