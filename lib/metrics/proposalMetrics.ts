import { recordMetricDistribution } from "@/lib/perf/metricsClient";
import { setMetric } from "@/lib/utils/metrics";

type ProposalMetricTags = {
  scope: string;
  result: string;
};

export function recordProposalWriteMetrics({
  scope,
  queueWaitMs,
  elapsedMs,
  result,
}: {
  scope: string;
  queueWaitMs: number;
  elapsedMs: number;
  result: string;
}): void {
  const tags: ProposalMetricTags = {
    scope,
    result,
  };
  if (Number.isFinite(queueWaitMs)) {
    recordMetricDistribution("client.proposal.queueWaitMs", queueWaitMs, tags);
    setMetric("client.proposal", `${scope}.queueWaitMs`, Number(queueWaitMs.toFixed(2)));
  }
  if (Number.isFinite(elapsedMs)) {
    recordMetricDistribution("client.proposal.txElapsedMs", elapsedMs, tags);
    setMetric("client.proposal", `${scope}.txElapsedMs`, Number(elapsedMs.toFixed(2)));
  }
}
