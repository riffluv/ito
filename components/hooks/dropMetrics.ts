import { recordMetricDistribution } from "@/lib/perf/metricsClient";
import { setMetric } from "@/lib/utils/metrics";
import type { DropOutcome } from "./dropHandlerEligibility";

export function createDropMetricsSession({
  optimisticMode,
  index,
}: {
  optimisticMode: boolean;
  index?: number;
}) {
  const startedAt = typeof performance !== "undefined" ? performance.now() : null;
  const baseTags: Record<string, string> = {
    mode: optimisticMode ? "optimistic" : "default",
  };
  if (typeof index === "number") {
    baseTags.index = String(index);
  }

  const storeDebugMetric = (name: string, value: number) => {
    const lastDot = name.lastIndexOf(".");
    if (lastDot <= 0) return;
    const scope = name.slice(0, lastDot);
    const key = name.slice(lastDot + 1);
    setMetric(scope, key, Number(value.toFixed(2)));
  };

  const computeSample = () => {
    if (startedAt === null || typeof performance === "undefined") return null;
    const sample = Number(Math.max(0, performance.now() - startedAt).toFixed(2));
    if (!Number.isFinite(sample)) return null;
    return sample;
  };

  const markStage = (metricId: string, extra?: Record<string, string>) => {
    const sample = computeSample();
    if (sample === null) return;
    recordMetricDistribution(metricId, sample, {
      ...baseTags,
      ...(extra ?? {}),
    });
    storeDebugMetric(metricId, sample);
  };

  const complete = (outcome: DropOutcome) => {
    const sample = computeSample();
    if (sample === null) return;
    recordMetricDistribution("client.drop.resolveMs", sample, {
      outcome,
      ...baseTags,
    });
    storeDebugMetric("client.drop.resolveMs", sample);
  };

  const abort = (outcome: DropOutcome) => {
    complete(outcome);
  };

  markStage("client.drop.t0_onDropStartMs");

  return {
    complete,
    abort,
    markStage,
  };
}

