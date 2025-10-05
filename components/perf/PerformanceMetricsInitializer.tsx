"use client";
import { useEffect } from "react";
import {
  recordMetricDistribution,
  shouldSendClientMetrics,
} from "@/lib/perf/metricsClient";

const DEFAULT_FPS_WINDOW = 5000;
const DEFAULT_INP_WINDOW = 15000;

function resolveNumber(envValue: string | undefined, fallback: number): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default function PerformanceMetricsInitializer() {
  useEffect(() => {
    if (!shouldSendClientMetrics()) return;
    const sampleWindow = resolveNumber(
      process.env.NEXT_PUBLIC_PERF_FPS_WINDOW_MS,
      DEFAULT_FPS_WINDOW
    );
    if (sampleWindow <= 0) return;

    let frameCount = 0;
    let windowStart = performance.now();
    let animationFrame = 0;

    const tick = (timestamp: number) => {
      frameCount += 1;
      const elapsed = timestamp - windowStart;
      if (elapsed >= sampleWindow) {
        const fps = (frameCount * 1000) / Math.max(elapsed, 1);
        recordMetricDistribution("client.fps.sample", Number(fps.toFixed(2)), {
          window: String(sampleWindow),
        });
        frameCount = 0;
        windowStart = timestamp;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldSendClientMetrics()) return;
    const supportsEventTiming =
      typeof PerformanceObserver !== "undefined" &&
      (PerformanceObserver as any).supportedEntryTypes?.includes?.("event");
    if (!supportsEventTiming) return;

    const flushInterval = resolveNumber(
      process.env.NEXT_PUBLIC_PERF_INP_WINDOW_MS,
      DEFAULT_INP_WINDOW
    );
    if (flushInterval <= 0) return;

    let worstInteraction: PerformanceEventTiming | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (!worstInteraction) return;
      const interactionId = (worstInteraction as any)?.interactionId;
      recordMetricDistribution("client.inp.rolling", worstInteraction.duration, {
        event: worstInteraction.name,
        interactionId: interactionId != null ? String(interactionId) : undefined,
      });
      worstInteraction = null;
    };

    const scheduleFlush = () => {
      if (flushTimer !== null) return;
      flushTimer = setTimeout(() => {
        flush();
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
      }, flushInterval);
    };

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        if (!entry || entry.duration <= 0) continue;
        if (entry.duration <= 16) continue; // ignore trivial interactions
        if (!worstInteraction || entry.duration > worstInteraction.duration) {
          worstInteraction = entry;
        }
      }
      scheduleFlush();
    });

    try {
      const observerOptions: PerformanceObserverInit = { type: "event", buffered: true };
      (observerOptions as any).durationThreshold = 40;
      observer.observe(observerOptions);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("PerformanceObserver setup failed", error);
      }
      flush();
      return () => undefined;
    }

    return () => {
      observer.disconnect();
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flush();
    };
  }, []);

  return null;
}




