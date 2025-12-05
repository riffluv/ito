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
const TRACE_DETAIL_ENTRY_LIMIT = 12;
const TRACE_DETAIL_STRING_LIMIT = 180;

const traceQueue: PendingTrace[] = [];
let flushScheduled = false;

const slimTraceDetail = (detail: TraceDetail): Record<string, unknown> | undefined => {
  if (!detail) return undefined;
  const sanitized: Record<string, unknown> = {};
  let added = 0;
  for (const [key, value] of Object.entries(detail)) {
    if (added >= TRACE_DETAIL_ENTRY_LIMIT) break;
    if (value === null || value === undefined) continue;

    if (typeof value === "string") {
      const text = value.length > TRACE_DETAIL_STRING_LIMIT
        ? `${value.slice(0, TRACE_DETAIL_STRING_LIMIT)}…`
        : value;
      sanitized[key] = text;
      added += 1;
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
      added += 1;
      continue;
    }

    if (Array.isArray(value)) {
      sanitized[key] = value
        .slice(0, 3)
        .map((item) => (typeof item === "string" || typeof item === "number" ? item : "[obj]"));
      added += 1;
      continue;
    }

    if (typeof value === "object") {
      const maybeId =
        (value as { id?: unknown }).id ??
        (value as { uid?: unknown }).uid ??
        (value as { type?: unknown }).type;
      if (typeof maybeId === "string" || typeof maybeId === "number") {
        sanitized[key] = maybeId;
        added += 1;
      }
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

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
  const slimDetail = slimTraceDetail(detail);
  try {
    recordMetricDistribution(`trace.action.${name}`, 1, toTags(slimDetail));
    const sentry = getSentry();
    sentry?.captureMessage?.(`[trace] action:${name}`, {
      level: "info",
      extra: slimDetail,
    });
    pushTraceRecord(name, slimDetail);
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[trace:action] ${name}`, slimDetail ?? {});
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
  traceQueue.push({ name, detail: slimTraceDetail(detail) });
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
  const slimDetail = slimTraceDetail(detail);
  try {
    const errorInfo = describeError(err);
    recordMetricDistribution(`trace.error.${name}`, 1, toTags(slimDetail));
    const sentry = getSentry();
    sentry?.captureMessage?.(`[trace] error:${name}`, {
      level: "error",
      extra: { ...slimDetail, error: errorInfo },
    });
    pushTraceRecord(name, slimDetail);
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(`[trace:error] ${name}`, { detail: slimDetail, error: errorInfo });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[trace:error] failed for ${name}`, error);
    }
  }
}
