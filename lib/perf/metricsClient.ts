import { setMetric } from "@/lib/utils/metrics";

type MetricTags = Record<string, string | undefined> | undefined;

type MetricsApi = {
  distribution?: (name: string, value: number, options?: { tags?: Record<string, string> }) => void;
};

type CaptureMessage = (message: string, context?: { level?: string; extra?: Record<string, unknown> }) => void;

type SentryGlobal = {
  metrics?: MetricsApi;
  captureMessage?: CaptureMessage;
};

type PendingMetric = {
  name: string;
  value: number;
  tags?: Record<string, string>;
};

const METRIC_BATCH_SIZE = 10;
const METRIC_FLUSH_TIMEOUT_MS = 400;
const metricQueue: PendingMetric[] = [];
let metricFlushScheduled = false;

function getMetricsApi(): MetricsApi | null {
  const globalScope = globalThis as typeof globalThis & { Sentry?: SentryGlobal };
  const maybeMetrics = globalScope.Sentry?.metrics;
  return maybeMetrics ?? null;
}

function sanitizeTags(tags: MetricTags): Record<string, string> | undefined {
  if (!tags) return undefined;
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (typeof value === "string" && value.length > 0) {
      sanitized[key] = value.slice(0, 100);
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

const flushMetricQueue = () => {
  metricFlushScheduled = false;
  if (metricQueue.length === 0) return;
  let metricsApi: MetricsApi | null = null;
  let capture: CaptureMessage | undefined;
  const globalScope = globalThis as typeof globalThis & { Sentry?: SentryGlobal };
  try {
    metricsApi = getMetricsApi();
    capture = globalScope.Sentry?.captureMessage;
  } catch {
    metricsApi = null;
  }

  while (metricQueue.length > 0) {
    const batch = metricQueue.splice(0, METRIC_BATCH_SIZE);
    for (const item of batch) {
      try {
        if (metricsApi?.distribution) {
          metricsApi.distribution(item.name, item.value, { tags: item.tags });
        } else {
          capture?.(`metrics:${item.name}` as string, {
            level: "info",
            extra: { value: item.value, tags: item.tags },
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("recordMetricDistribution flush failed", error);
        }
      }
    }
  }
};

const scheduleMetricFlush = () => {
  if (metricFlushScheduled) return;
  metricFlushScheduled = true;
  const idle = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof idle.requestIdleCallback === "function") {
    idle.requestIdleCallback(() => flushMetricQueue(), { timeout: METRIC_FLUSH_TIMEOUT_MS });
    return;
  }
  setTimeout(flushMetricQueue, METRIC_FLUSH_TIMEOUT_MS);
};

export function recordMetricDistribution(
  name: string,
  value: number,
  tags?: MetricTags
): void {
  if (!Number.isFinite(value)) return;
  const sanitizedTags = sanitizeTags(tags);
  try {
    const sample = Number(value.toFixed(2));
    if (Number.isFinite(sample)) {
      const lastDot = name.lastIndexOf(".");
      if (lastDot > 0) {
        const scope = name.slice(0, lastDot);
        const key = name.slice(lastDot + 1);
        setMetric(scope, key, sample);
      } else {
        setMetric("metrics", name, sample);
      }
    }
  } catch {
    // ignore local cache failures
  }
  metricQueue.push({ name, value, tags: sanitizedTags });
  scheduleMetricFlush();
}

export function shouldSendClientMetrics(): boolean {
  if (typeof window === "undefined" || typeof performance === "undefined") return false;
  if (process.env.NEXT_PUBLIC_DISABLE_CLIENT_METRICS === "1") return false;
  return true;
}
