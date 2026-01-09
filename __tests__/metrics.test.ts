import {
  bumpMetric,
  incrementPresenceMetric,
  metricsKey,
  readMetrics,
  setMetric,
  setPresenceMetric,
  subscribeMetrics,
} from "@/lib/utils/metrics";

describe("metrics", () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[metricsKey];
  });

  test("setMetric writes to window metrics and notifies subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeMetrics(listener);

    setMetric("scopeA", "key1", 123);

    const root = (window as unknown as Record<string, unknown>)[metricsKey] as Record<
      string,
      Record<string, unknown>
    >;
    expect(root.scopeA.key1).toBe(123);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ scopeA: expect.any(Object) }));

    unsubscribe();
  });

  test("bumpMetric increments numeric values and initializes missing values", () => {
    bumpMetric("scopeB", "count", 1);
    bumpMetric("scopeB", "count", 2);

    const metrics = readMetrics();
    expect(metrics.scopeB.count).toBe(3);
  });

  test("setMetric is idempotent when value is Object.is equal", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeMetrics(listener);

    setMetric("scopeC", "value", "x");
    listener.mockClear();
    setMetric("scopeC", "value", "x");

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  test("presence helpers write into presence scope", () => {
    incrementPresenceMetric("ping", 1);
    incrementPresenceMetric("ping", 1);
    setPresenceMetric("state", "ok");

    const metrics = readMetrics();
    expect(metrics.presence.ping).toBe(2);
    expect(metrics.presence.state).toBe("ok");
  });
});

