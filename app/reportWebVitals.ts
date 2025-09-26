import type { NextWebVitalsMetric } from "next/app";
import * as Sentry from "@sentry/nextjs";

type MetricsApi = {
  distribution?: (name: string, value: number, options?: { tags?: Record<string, string> }) => void;
};

const getMetricsApi = (): MetricsApi | null => {
  const maybeMetrics = (Sentry as unknown as { metrics?: MetricsApi }).metrics;
  return maybeMetrics || null;
};

const formatTags = (metric: NextWebVitalsMetric): Record<string, string> => ({
  id: metric.id,
  label: metric.label,
  name: metric.name,
});

export function reportWebVitals(metric: NextWebVitalsMetric) {
  try {
    const metrics = getMetricsApi();
    if (metrics?.distribution) {
      metrics.distribution(`web-vitals.${metric.name.toLowerCase()}`, metric.value, {
        tags: formatTags(metric),
      });
    } else {
      Sentry.captureMessage(`web-vital:${metric.name}`, {
        level: "info",
        extra: metric,
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("web vitals reporting failed", error);
    }
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug(`[WebVitals] ${metric.name}`, metric);
  }
}
