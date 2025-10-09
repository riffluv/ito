const METRICS_KEY = "__ITO_METRICS__";

type MetricsBucket = Record<string, number | string | null | undefined>;

export type ItoMetrics = Record<string, MetricsBucket>;

function getRoot(): ItoMetrics | null {
  if (typeof window === "undefined") return null;
  const existing = (window as any)[METRICS_KEY];
  if (existing && typeof existing === "object") {
    return existing as ItoMetrics;
  }
  const created: ItoMetrics = {};
  (window as any)[METRICS_KEY] = created;
  return created;
}

export function bumpMetric(scope: string, key: string, delta = 1): void {
  const root = getRoot();
  if (!root) return;
  const bucket = (root[scope] = root[scope] || {});
  const current = bucket[key];
  const next =
    typeof current === "number" && Number.isFinite(current)
      ? current + delta
      : delta;
  bucket[key] = next;
}

export function setMetric(scope: string, key: string, value: number | string | null): void {
  const root = getRoot();
  if (!root) return;
  const bucket = (root[scope] = root[scope] || {});
  bucket[key] = value;
}

export function readMetrics(): ItoMetrics {
  const root = getRoot();
  return root ? { ...root } : {};
}

export const metricsKey = METRICS_KEY;
