"use client";

import { useEffect, useRef } from "react";

const ENABLE_METRICS =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_ENABLE_RENDER_METRICS === "1" ||
    process.env.NEXT_PUBLIC_ENABLE_RENDER_METRICS === "true");

export interface RenderMetricsOptions {
  thresholdMs?: number;
}

export function useRenderMetrics(label: string, options?: RenderMetricsOptions) {
  if (!ENABLE_METRICS || typeof window === "undefined" || typeof performance === "undefined") {
    return;
  }

  const threshold = options?.thresholdMs ?? 0;
  const startRef = useRef<number>(performance.now());
  startRef.current = performance.now();

  useEffect(() => {
    if (!ENABLE_METRICS || typeof performance === "undefined") return;
    const duration = performance.now() - startRef.current;
    if (duration >= threshold) {
      // eslint-disable-next-line no-console
      console.log("[RenderMetrics] " + label + ": " + duration.toFixed(2) + "ms");
    }
  });
}
