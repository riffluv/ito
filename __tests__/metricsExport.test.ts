describe("metricsExport", () => {
  const ORIGINAL_EXPORT_URL = process.env.NEXT_PUBLIC_METRICS_EXPORT_URL;
  const ORIGINAL_EXPORT_INTERVAL = process.env.NEXT_PUBLIC_METRICS_EXPORT_INTERVAL_MS;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    process.env.NEXT_PUBLIC_METRICS_EXPORT_URL = "";
    process.env.NEXT_PUBLIC_METRICS_EXPORT_INTERVAL_MS = "";
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    process.env.NEXT_PUBLIC_METRICS_EXPORT_URL = ORIGINAL_EXPORT_URL;
    process.env.NEXT_PUBLIC_METRICS_EXPORT_INTERVAL_MS = ORIGINAL_EXPORT_INTERVAL;
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
    delete (globalThis as unknown as { crypto?: unknown }).crypto;
    delete (window.navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
  });

  async function importWithMocks() {
    jest.doMock("@/lib/utils/metrics", () => ({
      subscribeMetrics: jest.fn((listener: (metrics: Record<string, unknown>) => void) => {
        listener({ scope: { k: 1 } });
        return () => {};
      }),
    }));
    const mod = await import("@/lib/utils/metricsExport");
    return mod as typeof import("@/lib/utils/metricsExport");
  }

  test("does nothing when export URL is not configured", async () => {
    const setIntervalSpy = jest.spyOn(window, "setInterval");
    const { initMetricsExport } = await importWithMocks();
    initMetricsExport();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  test("initializes once and uses sendBeacon when available", async () => {
    process.env.NEXT_PUBLIC_METRICS_EXPORT_URL = "https://example.test/metrics";
    process.env.NEXT_PUBLIC_METRICS_EXPORT_INTERVAL_MS = "5000";

    (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto = {
      randomUUID: () => "uuid-123",
    };

    const sendBeacon = jest.fn(() => true);
    (window.navigator as unknown as { sendBeacon?: unknown }).sendBeacon = sendBeacon;

    const setIntervalSpy = jest.spyOn(window, "setInterval");
    const { initMetricsExport } = await importWithMocks();

    initMetricsExport();
    initMetricsExport();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(sendBeacon).toHaveBeenCalledWith(
      "https://example.test/metrics",
      expect.any(Blob)
    );
  });

  test("falls back to fetch when sendBeacon is unavailable", async () => {
    process.env.NEXT_PUBLIC_METRICS_EXPORT_URL = "https://example.test/metrics";
    process.env.NEXT_PUBLIC_METRICS_EXPORT_INTERVAL_MS = "5000";

    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (globalThis as unknown as { fetch?: unknown }).fetch = fetchMock;

    const { initMetricsExport } = await importWithMocks();
    initMetricsExport();

    // flush async sendPayload(fetch)
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/metrics",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      })
    );
  });
});

