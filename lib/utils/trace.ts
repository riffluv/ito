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
    if (value == null) continue;
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

const TRACE_BUFFER_KEY = "__ITO_TRACE_BUFFER__";
const TRACE_BUFFER_LIMIT = 10;

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

export function traceAction(name: string, detail?: Record<string, unknown>): void {
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
