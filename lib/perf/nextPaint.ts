import { setMetric } from "@/lib/utils/metrics";

export function scheduleNextPaintMetric(params: {
  scope: string;
  key: string;
  startedAt: number;
}): void {
  if (typeof window === "undefined") return;
  if (typeof performance === "undefined") return;
  if (typeof window.requestAnimationFrame !== "function") return;

  // double rAF: state updates -> layout -> paint の後に近いタイミングで測る
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const elapsed = Math.max(0, performance.now() - params.startedAt);
      setMetric(params.scope, params.key, Math.round(elapsed));
    });
  });
}

