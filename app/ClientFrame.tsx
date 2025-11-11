"use client";
import PerfStatsOverlay from "@/components/dev/PerfStatsOverlay";
import PerformanceMetricsInitializer from "@/components/perf/PerformanceMetricsInitializer";

import React from "react";

// Client-only wrapper.
// Hides the global Header on /rooms/ routes to maximize the AppShell.
// TransitionProvider replaces the legacy RPGPageTransition.
export function ClientFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PerformanceMetricsInitializer />
      
      <main id="main" role="main">{children}</main>
      <PerfStatsOverlay />
    </>
  );
}
export default ClientFrame;
