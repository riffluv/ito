import * as Sentry from "@sentry/nextjs";

type MetricTags = Record<string, string | undefined> | undefined;

type MetricsApi = {
  distribution?: (name: string, value: number, options?: { tags?: Record<string, string> }) => void;
};

function getMetricsApi(): MetricsApi | null {
  const maybeMetrics = (Sentry as unknown as { metrics?: MetricsApi }).metrics;
  return maybeMetrics || null;
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
    const metrics = getMetricsApi();
    const sanitizedTags = sanitizeTags(tags);
    if (metrics?.distribution) {
      metrics.distribution(name, value, {
        tags: sanitizedTags,
      });
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[metrics:fallback] ${name}`, { value, tags: sanitizedTags });
    }
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
