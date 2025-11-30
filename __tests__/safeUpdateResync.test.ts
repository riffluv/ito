jest.useFakeTimers();

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

describe("resyncWaitingServiceWorker", () => {
  beforeEach(() => {
    jest.resetModules();
    // Provide minimal SW support before importing the module.
    const { registration } = buildMockRegistration();
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: {
        controller: {},
        getRegistration: jest.fn().mockResolvedValue(registration),
      },
      configurable: true,
    });
    // Stub BroadcastChannel so updateChannel can instantiate it safely.
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
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it("raises an update snapshot when a waiting SW already exists", async () => {
    const {
      resyncWaitingServiceWorker,
      subscribeToSafeUpdateSnapshot,
      __safeUpdateMachine,
    } = await import("@/lib/serviceWorker/updateChannel");

    expect(__safeUpdateMachine).toBeDefined();

    const snapshots: string[] = [];
    const unsubscribe = subscribeToSafeUpdateSnapshot((snapshot) => {
      snapshots.push(snapshot.phase);
    });

    await resyncWaitingServiceWorker("test");
    // Flush the auto-apply timer so it cannot leak between tests.
    jest.runOnlyPendingTimers();

    unsubscribe();

    expect(
      snapshots.some((phase) =>
        ["update_detected", "auto_pending", "waiting_user"].includes(phase)
      )
    ).toBe(true);
  });
});
