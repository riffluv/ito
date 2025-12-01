import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import ServiceWorkerRegistration from "@/app/ServiceWorkerRegistration";

jest.mock("@/lib/serviceWorker/updateChannel", () => {
  const announceServiceWorkerUpdate = jest.fn();
  const clearAutoApplySuppression = jest.fn();
  const clearWaitingServiceWorker = jest.fn();
  const consumePendingApplyContext = jest.fn().mockReturnValue(null);
  const consumePendingReloadFlag = jest.fn().mockReturnValue(false);
  const getWaitingServiceWorker = jest.fn().mockReturnValue(null);
  const handleServiceWorkerFetchError = jest.fn();
  const markUpdateCheckEnd = jest.fn();
  const markUpdateCheckError = jest.fn();
  const markUpdateCheckStart = jest.fn();
  const resyncWaitingServiceWorker = jest.fn().mockResolvedValue(undefined);
  const subscribeToSafeUpdateSnapshot = jest.fn().mockReturnValue(() => {});
  const suppressAutoApply = jest.fn();
  const applyServiceWorkerUpdate = jest.fn();

  return {
    announceServiceWorkerUpdate,
    applyServiceWorkerUpdate,
    clearAutoApplySuppression,
    clearWaitingServiceWorker,
    consumePendingApplyContext,
    consumePendingReloadFlag,
    getWaitingServiceWorker,
    handleServiceWorkerFetchError,
    markUpdateCheckEnd,
    markUpdateCheckError,
    markUpdateCheckStart,
    resyncWaitingServiceWorker,
    subscribeToSafeUpdateSnapshot,
    suppressAutoApply,
    __mocks: {
      announceServiceWorkerUpdate,
      applyServiceWorkerUpdate,
      clearAutoApplySuppression,
      clearWaitingServiceWorker,
      consumePendingApplyContext,
      consumePendingReloadFlag,
      getWaitingServiceWorker,
      handleServiceWorkerFetchError,
      markUpdateCheckEnd,
      markUpdateCheckError,
      markUpdateCheckStart,
      resyncWaitingServiceWorker,
      subscribeToSafeUpdateSnapshot,
      suppressAutoApply,
    },
  };
});

const getSwMocks = () =>
  (jest.requireMock("@/lib/serviceWorker/updateChannel").__mocks ||
    {}) as Record<string, jest.Mock>;

type MutableRegistration = {
  waiting: ServiceWorker | null;
  installing: ServiceWorker | null;
  active: ServiceWorker | null;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  update: jest.Mock;
  unregister?: jest.Mock;
  scope?: string;
};

const createMockWaiting = (): ServiceWorker & { postMessage: jest.Mock } =>
  ({
    state: "installed",
    scriptURL: "https://example.com/sw.js?v=test",
    postMessage: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  } as unknown as ServiceWorker & { postMessage: jest.Mock });

const buildNavigatorMock = (registration: MutableRegistration) => {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const serviceWorker = {
    controller: {},
    addEventListener: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(handler);
    }),
    removeEventListener: jest.fn(),
    getRegistration: jest.fn().mockResolvedValue(registration),
    register: jest.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
  };

  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });

  return listeners;
};

describe("ServiceWorkerRegistration waiting detection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("announces an existing waiting worker on mount", async () => {
    const waiting = createMockWaiting();
    const registration: MutableRegistration = {
      waiting,
      installing: null,
      active: waiting,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      update: jest.fn(),
      unregister: jest.fn(),
      scope: "/",
    };

    buildNavigatorMock(registration);

    render(<ServiceWorkerRegistration />);

    const { announceServiceWorkerUpdate } = getSwMocks();
    await waitFor(() => {
      expect(announceServiceWorkerUpdate).toHaveBeenCalledWith(registration);
    });
  });

  it("picks up a waiting worker created during updatefound even if already installed", async () => {
    const waiting = createMockWaiting();
    const registration: MutableRegistration = {
      waiting: null,
      installing: null,
      active: waiting,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      update: jest.fn(),
      unregister: jest.fn(),
      scope: "/",
    };

    const regListeners = buildNavigatorMock(registration);

    render(<ServiceWorkerRegistration />);

    // Clear any accidental calls from mount.
    getSwMocks().announceServiceWorkerUpdate.mockClear();

    // Simulate a new worker that is already installed/waiting when updatefound fires.
    registration.installing = waiting;
    registration.waiting = waiting;
    regListeners.updatefound?.forEach((fn) => {
      act(() => {
        fn();
      });
    });

    const { announceServiceWorkerUpdate } = getSwMocks();
    await waitFor(() => {
      expect(announceServiceWorkerUpdate).toHaveBeenCalledWith(registration);
    });
  });

  it("uses NEXT_PUBLIC_SW_VERSION when buildId is not available", async () => {
    const waiting = createMockWaiting();
    const registration: MutableRegistration = {
      waiting: null,
      installing: null,
      active: waiting,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      update: jest.fn(),
      unregister: jest.fn(),
      scope: "/",
    };

    // Ensure runtime buildId is absent so env is used.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__NEXT_DATA__;
    const prevSwVersion = process.env.NEXT_PUBLIC_SW_VERSION;
    process.env.NEXT_PUBLIC_SW_VERSION = "jest-sw-version";

    const listeners = buildNavigatorMock(registration);

    render(<ServiceWorkerRegistration />);

    // Simulate a waiting worker to trigger register() call path.
    registration.installing = waiting;
    registration.waiting = waiting;
    listeners.updatefound?.forEach((fn) => {
      act(() => {
        fn();
      });
    });

    await waitFor(() => {
      expect(
        (navigator.serviceWorker.register as jest.Mock).mock.calls[0][0]
      ).toBe("/sw.js?v=jest-sw-version");
    });

    process.env.NEXT_PUBLIC_SW_VERSION = prevSwVersion;
  });
});
