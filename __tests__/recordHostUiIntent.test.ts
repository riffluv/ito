const bumpMetricMock = jest.fn();
const setMetricMock = jest.fn();
const traceActionMock = jest.fn();
const scheduleNextPaintMetricMock = jest.fn();

jest.mock("@/lib/utils/metrics", () => ({
  bumpMetric: (...args: unknown[]) => bumpMetricMock(...args),
  setMetric: (...args: unknown[]) => setMetricMock(...args),
}));

jest.mock("@/lib/utils/trace", () => ({
  traceAction: (...args: unknown[]) => traceActionMock(...args),
}));

jest.mock("@/lib/perf/nextPaint", () => ({
  scheduleNextPaintMetric: (...args: unknown[]) => scheduleNextPaintMetricMock(...args),
}));

import { recordHostUiIntent } from "@/lib/hooks/hostActions/recordHostUiIntent";

describe("recordHostUiIntent", () => {
  beforeEach(() => {
    bumpMetricMock.mockClear();
    setMetricMock.mockClear();
    traceActionMock.mockClear();
    scheduleNextPaintMetricMock.mockClear();
  });

  test("records metrics, trace, and next paint", () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(123456789);

    try {
      recordHostUiIntent({
        roomId: "room-1",
        intent: "quickStart",
        startedAt: 10,
        clickMetricKey: "ui.quickStart.clicks",
        nextPaintMetricKey: "ui.quickStart.nextPaintMs",
      });

      expect(bumpMetricMock).toHaveBeenCalledWith("hostAction", "ui.quickStart.clicks", 1);
      expect(setMetricMock).toHaveBeenCalledWith("hostAction", "ui.lastIntent", "quickStart");
      expect(setMetricMock).toHaveBeenCalledWith("hostAction", "ui.lastIntentAt", 123456789);
      expect(traceActionMock).toHaveBeenCalledWith("ui.host.quickStart.intent", {
        roomId: "room-1",
      });
      expect(scheduleNextPaintMetricMock).toHaveBeenCalledWith({
        scope: "hostAction",
        key: "ui.quickStart.nextPaintMs",
        startedAt: 10,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });
});

