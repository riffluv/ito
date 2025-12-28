jest.useFakeTimers();

jest.mock("@/lib/telemetry/safeUpdate", () => ({
  logSafeUpdateTelemetry: jest.fn(),
}));

jest.mock("@/lib/utils/trace", () => ({
  traceAction: jest.fn(),
  traceError: jest.fn(),
}));

const buildMockRegistration = () => {
  const waiting: ServiceWorker & {
    postMessage: jest.Mock;
  } = {
    state: "installed",
    scriptURL: "https://example.com/sw.js?v=test-version",
    postMessage: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    onstatechange: null,
    // @ts-expect-error jsdom partial
    clients: undefined,
  };

  const registration: ServiceWorkerRegistration = {
    waiting,
    // @ts-expect-error jsdom partial
    installing: null,
    // @ts-expect-error jsdom partial
    active: null,
    // @ts-expect-error jsdom partial
    scope: "/",
    update: jest.fn(),
    unregister: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };

  return { waiting, registration };
};

describe("applyServiceWorkerUpdate retry", () => {
  beforeEach(() => {
    jest.resetModules();
    // Safe Update の fallback reload は jsdom では未実装なので、テスト中は抑止する。
    try {
      sessionStorage.setItem("ito-safe-update-fallback-reload-count", "2");
    } catch {
      /* noop */
    }
    const { registration } = buildMockRegistration();
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: {
        controller: {},
        getRegistration: jest.fn().mockResolvedValue(registration),
      },
      configurable: true,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.BroadcastChannel = class {
      addEventListener() {
        /* noop */
      }
      postMessage() {
        /* noop */
      }
      close() {
        /* noop */
      }
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("sends RETRY when phase is failed", async () => {
    const { waiting } = buildMockRegistration();
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: {
        controller: {},
        getRegistration: jest.fn().mockResolvedValue({ waiting }),
      },
      configurable: true,
    });

    const {
      applyServiceWorkerUpdate,
      getSafeUpdateSnapshot,
      resyncWaitingServiceWorker,
    } = await import("@/lib/serviceWorker/updateChannel");

    await resyncWaitingServiceWorker("test");

    // First apply → applying.
    expect(applyServiceWorkerUpdate({ reason: "manual" })).toBe(true);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    // Let apply timeout to enter failed state (keeps waiting in context).
    jest.runOnlyPendingTimers();
    expect(getSafeUpdateSnapshot().phase).toBe("failed");

    // Second apply should trigger RETRY and postMessage again.
    expect(applyServiceWorkerUpdate({ reason: "manual" })).toBe(true);
    expect(waiting.postMessage).toHaveBeenCalledTimes(2);
  });
});
