"use client";
import { useEffect } from "react";
import {
  recordMetricDistribution,
  shouldSendClientMetrics,
} from "@/lib/perf/metricsClient";

const DEFAULT_FPS_WINDOW = 5000;
const DEFAULT_INP_WINDOW = 15000;
const TRACE_BUFFER_KEY = "__ITO_TRACE_BUFFER__";
const TRACE_RECENT_THRESHOLD_MS = 2000;
const ENABLE_INTERACTION_TAGS =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_PERF_INTERACTION_TAGS === "1";

type TraceBufferRecord = {
  name: string;
  detail?: Record<string, unknown>;
  timestamp: number;
};

type MetricsBuckets = Record<string, Record<string, unknown>>;

type MetricsWindow = typeof window & {
  __ITO_METRICS__?: MetricsBuckets;
  __ITO_TRACE_BUFFER__?: TraceBufferRecord[];
  dumpItoMetrics?: (label?: string) => unknown;
  dumpItoMetricsJson?: (label?: string) => string;
};

type ExtendedPerformanceObserver = typeof PerformanceObserver & {
  supportedEntryTypes?: readonly string[];
};

type ExtendedPerformanceObserverInit = PerformanceObserverInit & {
  durationThreshold?: number;
};

type InteractionWithId = PerformanceEventTiming & {
  interactionId?: number;
};

declare global {
  interface Window {
    dumpItoMetrics?: (label?: string) => unknown;
    dumpItoMetricsJson?: (label?: string) => string;
  }
}

function resolveNumber(envValue: string | undefined, fallback: number): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pickRecentTraceTag(interaction: PerformanceEventTiming) {
  if (!ENABLE_INTERACTION_TAGS || typeof performance === "undefined") return undefined;
  const scope = globalThis as typeof globalThis & {
    [TRACE_BUFFER_KEY]?: TraceBufferRecord[];
  };
  const buffer = scope[TRACE_BUFFER_KEY];
  if (!buffer || buffer.length === 0) return undefined;
  const start = interaction.startTime;
  let candidate: TraceBufferRecord | undefined;
  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    const record = buffer[index];
    if (!record) continue;
    if (start >= record.timestamp && start - record.timestamp <= TRACE_RECENT_THRESHOLD_MS) {
      candidate = record;
      break;
    }
  }
  if (!candidate) return undefined;
  const tags: Record<string, string> = {
    trace: candidate.name.slice(0, 60),
  };
  if (candidate.detail && typeof candidate.detail === "object") {
    const detail = candidate.detail as Record<string, unknown>;
    const maybeString = (value: unknown) =>
      typeof value === "string" && value.length > 0 ? value.slice(0, 80) : undefined;
    const phase = maybeString(detail.phase);
    if (phase) tags.tracePhase = phase;
    const source = maybeString(detail.source);
    if (source) tags.traceSource = source;
    const scopeTag = maybeString(detail.scope);
    if (scopeTag) tags.traceScope = scopeTag;
  }
  return tags;
}

export default function PerformanceMetricsInitializer() {
  useEffect(() => {
    const cleanup = () => {
      if (typeof window !== "undefined") {
        delete window.dumpItoMetrics;
        delete window.dumpItoMetricsJson;
      }
    };
    if (typeof window === "undefined") {
      return cleanup;
    }
    const metricsWindow = window as MetricsWindow;
    const buildSnapshot = (label?: string) => {
      const metrics = metricsWindow.__ITO_METRICS__ ?? {};
      const traces = metricsWindow.__ITO_TRACE_BUFFER__ ?? [];

      const perf = metrics.perf ?? {};
      const audio = metrics.audio ?? {};
      const app = metrics.app ?? {};
      const hostAction = metrics.hostAction ?? {};
      const presence = metrics.presence ?? {};
      const participants = metrics.participants ?? {};
      const room = metrics.room ?? {};
      const roomSnapshot = metrics.roomSnapshot ?? {};
      const phase = metrics.phase ?? {};
      const roundFlow = metrics.roundFlow ?? {};
      const safeUpdate = metrics.safeUpdate ?? {};
      const api = metrics.api ?? {};
      const drag = metrics.drag ?? {};
      const clientFps = metrics["client.fps"] ?? {};
      const clientInp = metrics["client.inp"] ?? {};
      const clientApi = metrics["client.api"] ?? {};
      const dropRecords = Object.fromEntries(
        Object.entries(metrics).filter(([key]) => key.startsWith("client.drop"))
      );

      return {
        label: typeof label === "string" && label.trim().length > 0 ? label.trim() : null,
        at: new Date().toISOString(),
        path: typeof window.location?.pathname === "string" ? window.location.pathname : null,
        perf,
        app,
        hostAction,
        presence,
        participants,
        room,
        roomSnapshot,
        phase,
        roundFlow,
        safeUpdate,
        api,
        drag,
        client: {
          fps: clientFps,
          inp: clientInp,
          api: clientApi,
        },
        audio,
        dropRecords: Object.keys(dropRecords).length > 0 ? dropRecords : null,
        traces,
      };
    };

    metricsWindow.dumpItoMetrics = (label?: string) => {
      const snapshot = buildSnapshot(label);
      /* eslint-disable no-console */
      const title = snapshot.label ? `ITO metrics snapshot (${snapshot.label})` : "ITO metrics snapshot";
      console.group(title);
      console.log("snapshot:", snapshot);
      console.groupEnd();
      /* eslint-enable no-console */
      return snapshot;
    };

    metricsWindow.dumpItoMetricsJson = (label?: string) => {
      const snapshot = buildSnapshot(label);
      const json = JSON.stringify(snapshot, null, 2);
      /* eslint-disable no-console */
      const title = snapshot.label ? `ITO metrics JSON (${snapshot.label})` : "ITO metrics JSON";
      console.group(title);
      console.log(json);
      console.groupEnd();
      /* eslint-enable no-console */
      return json;
    };
    return cleanup;
  }, []);

  useEffect(() => {
    let animationFrame: number | null = null;
    const cleanup = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };
    if (!shouldSendClientMetrics()) return cleanup;
    const sampleWindow = resolveNumber(
      process.env.NEXT_PUBLIC_PERF_FPS_WINDOW_MS,
      DEFAULT_FPS_WINDOW
    );
    if (sampleWindow <= 0) return cleanup;

    let frameCount = 0;
    let windowStart = performance.now();

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
    return cleanup;
  }, []);

  useEffect(() => {
    let worstInteraction: PerformanceEventTiming | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: PerformanceObserver | null = null;

    const flush = () => {
      if (!worstInteraction) {
        return;
      }
      const interactionId = (worstInteraction as InteractionWithId)?.interactionId;
      const tags: Record<string, string> = {
        event: worstInteraction.name,
      };
      if (interactionId !== undefined && interactionId !== null) {
        tags.interactionId = String(interactionId);
      }
      const traceTags = pickRecentTraceTag(worstInteraction);
      if (traceTags) {
        Object.assign(tags, traceTags);
      }
      recordMetricDistribution("client.inp.rolling", worstInteraction.duration, tags);
      worstInteraction = null;
    };

    const cleanup = () => {
      observer?.disconnect();
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flush();
    };

    if (!shouldSendClientMetrics()) return cleanup;
    if (typeof PerformanceObserver === "undefined") return cleanup;

    const supportedEntryTypes = (
      PerformanceObserver as ExtendedPerformanceObserver
    ).supportedEntryTypes;
    const supportsEventTiming = supportedEntryTypes?.includes?.("event") ?? false;
    if (!supportsEventTiming) return cleanup;

    const flushInterval = resolveNumber(
      process.env.NEXT_PUBLIC_PERF_INP_WINDOW_MS,
      DEFAULT_INP_WINDOW
    );
    if (flushInterval <= 0) return cleanup;

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

    observer = new PerformanceObserver((list) => {
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
      const observerOptions: ExtendedPerformanceObserverInit = {
        type: "event",
        buffered: true,
        durationThreshold: 40,
      };
      observer.observe(observerOptions);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("PerformanceObserver setup failed", error);
      }
      flush();
      return cleanup;
    }

    return cleanup;
  }, []);

  return null;
}




