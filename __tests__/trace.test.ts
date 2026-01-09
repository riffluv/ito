import { recordMetricDistribution } from "@/lib/perf/metricsClient";
import { traceAction, traceError } from "@/lib/utils/trace";

jest.mock("@/lib/perf/metricsClient", () => ({
  recordMetricDistribution: jest.fn(),
}));

describe("trace", () => {
  const originalSentry = (globalThis as typeof globalThis & { Sentry?: unknown }).Sentry;
  const originalRandom = Math.random;

  beforeEach(() => {
    (recordMetricDistribution as unknown as jest.Mock).mockClear();
    jest.spyOn(Math, "random").mockReturnValue(0);
    jest.spyOn(console, "debug").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    (globalThis as typeof globalThis & { Sentry?: unknown }).Sentry = {
      captureMessage: jest.fn(),
    };
    delete (globalThis as unknown as { __ITO_TRACE_BUFFER__?: unknown }).__ITO_TRACE_BUFFER__;
  });

  afterEach(() => {
    (globalThis as typeof globalThis & { Sentry?: unknown }).Sentry = originalSentry;
    Math.random = originalRandom;
    jest.restoreAllMocks();
  });

  test("traceAction records a metric and pushes to the in-memory buffer", () => {
    traceAction("unit.test", { ok: true, n: 1 });

    expect(recordMetricDistribution).toHaveBeenCalledWith(
      "trace.action.unit.test",
      1,
      expect.any(Object)
    );

    const buffer = (globalThis as unknown as { __ITO_TRACE_BUFFER__?: Array<{ name: string }> })
      .__ITO_TRACE_BUFFER__;
    expect(buffer).toBeTruthy();
    expect(buffer?.[buffer.length - 1]?.name).toBe("unit.test");
  });

  test("traceAction queues high-frequency traces (drag.*) and flushes via requestIdleCallback", () => {
    const idle = jest.fn((cb: () => void) => {
      cb();
      return 1;
    });
    (globalThis as unknown as { requestIdleCallback?: unknown }).requestIdleCallback = idle;

    traceAction("drag.unit.test", { x: 1 });

    expect(idle).toHaveBeenCalled();
    expect(recordMetricDistribution).toHaveBeenCalledWith(
      "trace.action.drag.unit.test",
      1,
      expect.any(Object)
    );
  });

  test("traceError records a metric and reports to Sentry", () => {
    const sentry = (globalThis as unknown as { Sentry?: { captureMessage?: jest.Mock } }).Sentry;
    traceError("unit.fail", new Error("boom"), { where: "test" });

    expect(recordMetricDistribution).toHaveBeenCalledWith(
      "trace.error.unit.fail",
      1,
      expect.any(Object)
    );
    expect(sentry?.captureMessage).toHaveBeenCalledWith(
      "[trace] error:unit.fail",
      expect.objectContaining({ level: "error" })
    );
  });
});
