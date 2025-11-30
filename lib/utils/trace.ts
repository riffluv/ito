"use client";

import { recordMetricDistribution } from "@/lib/perf/metricsClient";

type TraceDetail = Record<string, unknown> | undefined;

type SentryGlobal = {
  captureMessage?: (
    message: string,
    context?: { level?: "info" | "warning" | "error"; extra?: Record<string, unknown> }
  ) => void;
};

function getSentry(): SentryGlobal | null {
  const scope = globalThis as typeof globalThis & { Sentry?: SentryGlobal };
  return scope.Sentry ?? null;
}

function toTags(detail: TraceDetail): Record<string, string> | undefined {
  if (!detail) return undefined;
  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (value === null || value === undefined) continue;
    let text: string;
    if (typeof value === "string") {
      text = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      text = String(value);
    } else {
      try {
        text = JSON.stringify(value);
      } catch {
        text = "[unserializable]";
      }
    }
    if (text.length === 0) continue;
    tags[key.slice(0, 40)] = text.slice(0, 120);
  }
  return Object.keys(tags).length > 0 ? tags : undefined;
}

function describeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  if (typeof err === "string") {
    return { message: err };
  }
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

type TraceRecord = {
  name: string;
  detail: TraceDetail;
  timestamp: number;
};

type PendingTrace = {
  name: string;
  detail: TraceDetail;
};

const TRACE_BUFFER_KEY = "__ITO_TRACE_BUFFER__";
const TRACE_BUFFER_LIMIT = 10;
const HIGH_FREQUENCY_PREFIXES = ["drag."] as const;
const HIGH_FREQUENCY_SAMPLE_RATE = 0.2; // 20% サンプリングでメインスレッド負荷を抑える

const traceQueue: PendingTrace[] = [];
let flushScheduled = false;

const getIdleApi = () =>
  globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

function pushTraceRecord(name: string, detail: TraceDetail) {
  if (typeof performance === "undefined") return;
  const scope = globalThis as typeof globalThis & {
    [TRACE_BUFFER_KEY]?: TraceRecord[];
  };
  const buffer = scope[TRACE_BUFFER_KEY] ?? (scope[TRACE_BUFFER_KEY] = []);
  buffer.push({
    name,
    detail,
    timestamp: performance.now(),
  });
  if (buffer.length > TRACE_BUFFER_LIMIT) {
    buffer.splice(0, buffer.length - TRACE_BUFFER_LIMIT);
  }
}

function emitTraceImmediately(name: string, detail?: Record<string, unknown>): void {
  try {
    recordMetricDistribution(`trace.action.${name}`, 1, toTags(detail));
    const sentry = getSentry();
    sentry?.captureMessage?.(`[trace] action:${name}`, {
      level: "info",
      extra: detail,
    });
    pushTraceRecord(name, detail);
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[trace:action] ${name}`, detail ?? {});
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[trace:action] failed for ${name}`, error);
    }
  }
}

function flushTraceQueue(
  deadline?: {
    didTimeout: boolean;
    timeRemaining: () => number;
  }
) {
  while (traceQueue.length > 0) {
    if (
      deadline &&
      !deadline.didTimeout &&
      typeof deadline.timeRemaining === "function" &&
      deadline.timeRemaining() <= 2
    ) {
      scheduleTraceFlush();
      return;
    }
    const item = traceQueue.shift();
    if (!item) continue;
    emitTraceImmediately(item.name, item.detail);
  }
  flushScheduled = false;
}

function scheduleTraceFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  const idle = getIdleApi();
  const cb = (
    deadline?: {
      didTimeout: boolean;
      timeRemaining: () => number;
    }
  ) => {
    flushTraceQueue(deadline);
  };
  if (typeof idle.requestIdleCallback === "function") {
    idle.requestIdleCallback(cb, { timeout: 120 });
  } else {
    setTimeout(cb, 0);
  }
}

function enqueueTrace(name: string, detail?: Record<string, unknown>) {
  traceQueue.push({ name, detail });
  if (!flushScheduled) {
    scheduleTraceFlush();
  }
}

function isHighFrequencyTrace(name: string) {
  return HIGH_FREQUENCY_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export function traceAction(name: string, detail?: Record<string, unknown>): void {
  const highFreq = isHighFrequencyTrace(name);
  if (highFreq && Math.random() > HIGH_FREQUENCY_SAMPLE_RATE) {
    return; // サンプリングで間引き
  }

  if (highFreq) {
    enqueueTrace(name, detail);
    return;
  }

  emitTraceImmediately(name, detail);
}

export function traceError(
  name: string,
  err: unknown,
  detail?: Record<string, unknown>
): void {
  try {
    const errorInfo = describeError(err);
    recordMetricDistribution(`trace.error.${name}`, 1, toTags(detail));
    const sentry = getSentry();
    sentry?.captureMessage?.(`[trace] error:${name}`, {
      level: "error",
      extra: { ...detail, error: errorInfo },
    });
    pushTraceRecord(name, detail);
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(`[trace:error] ${name}`, { detail, error: errorInfo });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[trace:error] failed for ${name}`, error);
    }
  }
}
