import { scheduleNextPaintMetric } from "@/lib/perf/nextPaint";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";

export function recordHostUiIntent(options: {
  roomId: string;
  intent: "quickStart" | "reset" | "nextGame";
  startedAt: number;
  clickMetricKey:
    | "ui.quickStart.clicks"
    | "ui.reset.clicks"
    | "ui.nextGame.clicks";
  nextPaintMetricKey:
    | "ui.quickStart.nextPaintMs"
    | "ui.reset.nextPaintMs"
    | "ui.nextGame.nextPaintMs";
}) {
  bumpMetric("hostAction", options.clickMetricKey, 1);
  setMetric("hostAction", "ui.lastIntent", options.intent);
  setMetric("hostAction", "ui.lastIntentAt", Date.now());
  traceAction(`ui.host.${options.intent}.intent`, { roomId: options.roomId });
  scheduleNextPaintMetric({
    scope: "hostAction",
    key: options.nextPaintMetricKey,
    startedAt: options.startedAt,
  });
}

