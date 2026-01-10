const setMetricMock = jest.fn();

jest.mock("@/lib/utils/metrics", () => ({
  setMetric: (...args: unknown[]) => setMetricMock(...args),
}));

type MetricsModule = typeof import("@/lib/services/roomApiClient/metrics");

async function loadMetricsModule(
  interactionTags: "0" | "1" | undefined
): Promise<MetricsModule> {
  jest.resetModules();
  if (interactionTags === undefined) {
    delete process.env.NEXT_PUBLIC_PERF_INTERACTION_TAGS;
  } else {
    process.env.NEXT_PUBLIC_PERF_INTERACTION_TAGS = interactionTags;
  }

  return await import("@/lib/services/roomApiClient/metrics");
}

describe("roomApiClient metrics helpers", () => {
  beforeEach(() => {
    setMetricMock.mockClear();
    delete (globalThis as typeof globalThis & { __ITO_TRACE_BUFFER__?: unknown })
      .__ITO_TRACE_BUFFER__;
  });

  test("normalizeApiUrlForMetrics strips query/host and normalizes ids", async () => {
    const { normalizeApiUrlForMetrics } = await loadMetricsModule("0");

    expect(
      normalizeApiUrlForMetrics("https://example.com/api/rooms/ROOM123/start?x=1&y=2")
    ).toBe("/api/rooms/:roomId/start");

    expect(
      normalizeApiUrlForMetrics("/api/spectator/sessions/SESSION123/approve?foo=bar")
    ).toBe("/api/spectator/sessions/:sessionId/approve");

    expect(normalizeApiUrlForMetrics("api/rooms/ROOM123/finalize")).toBe(
      "/api/rooms/:roomId/finalize"
    );
  });

  test("shouldRecordApiTiming skips heartbeat and samples proposal", async () => {
    const { shouldRecordApiTiming } = await loadMetricsModule("0");

    expect(shouldRecordApiTiming("/api/presence/heartbeat")).toBe(false);

    const randomSpy = jest.spyOn(Math, "random");
    randomSpy.mockReturnValue(0.0);
    expect(shouldRecordApiTiming("/api/rooms/:roomId/proposal")).toBe(true);
    randomSpy.mockReturnValue(0.99);
    expect(shouldRecordApiTiming("/api/rooms/:roomId/proposal")).toBe(false);
    randomSpy.mockRestore();
  });

  test("pickRecentTraceTags returns tags and records api.lastTrace when enabled", async () => {
    const { pickRecentTraceTags } = await loadMetricsModule("1");
    (globalThis as typeof globalThis & { __ITO_TRACE_BUFFER__?: unknown }).__ITO_TRACE_BUFFER__ =
      [
        {
          name: "ui.old",
          detail: { phase: "old" },
          timestamp: 1,
        },
        {
          name: "ui.order.submit",
          detail: { phase: "clue", source: "intent", scope: "room" },
          timestamp: 900,
        },
      ];

    const tags = pickRecentTraceTags(1000);
    expect(tags).toEqual({
      trace: "ui.order.submit",
      tracePhase: "clue",
      traceSource: "intent",
      traceScope: "room",
    });
    expect(setMetricMock).toHaveBeenCalledWith("api", "lastTrace", "ui.order.submit");

    setMetricMock.mockClear();
    expect(pickRecentTraceTags(10_000)).toBeUndefined();
    expect(setMetricMock).not.toHaveBeenCalled();
  });
});
