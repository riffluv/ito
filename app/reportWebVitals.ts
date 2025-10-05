import { recordMetricDistribution } from "@/lib/perf/metricsClient";
import type { NextWebVitalsMetric } from "next/app";

const formatTags = (metric: NextWebVitalsMetric): Record<string, string> => ({
  id: metric.id,
  label: metric.label,
  name: metric.name,
});

export function reportWebVitals(metric: NextWebVitalsMetric) {
  recordMetricDistribution(`web-vitals.${metric.name.toLowerCase()}`, metric.value, formatTags(metric));

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug(`[WebVitals] ${metric.name}`, metric);
  }
}
