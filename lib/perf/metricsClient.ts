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

export function recordMetricDistribution(
  name: string,
  value: number,
  tags?: MetricTags
): void {
  if (!Number.isFinite(value)) return;
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
  try {
    const metrics = getMetricsApi();
    const sanitizedTags = sanitizeTags(tags);
    if (metrics?.distribution) {
      metrics.distribution(name, value, {
        tags: sanitizedTags,
      });
      return;
    }

    const globalScope = globalThis as typeof globalThis & { Sentry?: SentryGlobal };
    const capture = globalScope.Sentry?.captureMessage;
    capture?.(`metrics:${name}`, {
      level: "info",
      extra: { value, tags: sanitizedTags },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("recordMetricDistribution failed", error);
    }
  }
}

export function shouldSendClientMetrics(): boolean {
  if (typeof window === "undefined" || typeof performance === "undefined") return false;
  if (process.env.NEXT_PUBLIC_DISABLE_CLIENT_METRICS === "1") return false;
  return true;
}
