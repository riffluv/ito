jest.mock("@/lib/telemetry/safeUpdate", () => ({
  logSafeUpdateTelemetry: jest.fn(),
}));

jest.mock("@/lib/utils/trace", () => ({
  traceAction: jest.fn(),
  traceError: jest.fn(),
}));

import { createActor } from "xstate";
import { __safeUpdateMachine } from "@/lib/serviceWorker/updateChannel";

type FakeWaiting = {
  state: ServiceWorkerState;
  postMessage: jest.Mock;
};

describe("safeUpdateMachine", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  function createRegistration(): ServiceWorkerRegistration {
    const waiting: FakeWaiting = {
      state: "installed",
      postMessage: jest.fn(),
    };
    return {
      waiting,
    } as unknown as ServiceWorkerRegistration;
  }

  it("automatically applies a waiting registration after the auto timer expires", () => {
    const actor = createActor(__safeUpdateMachine);
    actor.start();

    const registration = createRegistration();
    actor.send({ type: "WAITING_DETECTED", registration, broadcast: false });
    expect(actor.getSnapshot().value).toBe("auto_pending");

    actor.send({ type: "AUTO_TIMER_EXPIRED" });
    expect(actor.getSnapshot().value).toBe("applying");
    expect(registration.waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    actor.send({ type: "APPLY_SUCCESS", broadcast: false });
    const appliedSnapshot = actor.getSnapshot();
    expect(appliedSnapshot.value).toBe("applied");
    expect(appliedSnapshot.context.pendingReload).toBe(true);

    actor.send({ type: "WAITING_CLEARED", result: "activated", broadcast: false });
    expect(actor.getSnapshot().value).toBe("idle");
  });

  it("handles manual apply and transitions to applied", () => {
    const actor = createActor(__safeUpdateMachine);
    actor.start();
    const registration = createRegistration();

    actor.send({ type: "WAITING_DETECTED", registration, broadcast: false });
    actor.send({
      type: "APPLY_REQUEST",
      reason: "manual",
      safeMode: false,
      automatic: false,
    });

    expect(actor.getSnapshot().value).toBe("applying");
    expect(registration.waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    actor.send({ type: "APPLY_SUCCESS", broadcast: false });
    expect(actor.getSnapshot().value).toBe("applied");

    actor.send({ type: "WAITING_CLEARED", result: "activated", broadcast: false });
    expect(actor.getSnapshot().value).toBe("idle");
  });

  it("records failure when redundant and allows retry", () => {
    const actor = createActor(__safeUpdateMachine);
    actor.start();
    const registration = createRegistration();

    actor.send({ type: "WAITING_DETECTED", registration, broadcast: false });
    actor.send({
      type: "APPLY_REQUEST",
      reason: "manual",
      safeMode: false,
      automatic: false,
    });
    expect(actor.getSnapshot().value).toBe("applying");

    actor.send({
      type: "APPLY_FAILURE",
      detail: "redundant",
      reason: "manual",
      safeMode: false,
      broadcast: false,
    });
    const failedSnapshot = actor.getSnapshot();
    expect(failedSnapshot.value).toBe("failed");
    expect(failedSnapshot.context.lastError).toBe("redundant");
    expect(failedSnapshot.context.retryCount).toBeGreaterThan(0);

    actor.send({
      type: "RETRY",
      reason: "manual",
      safeMode: false,
      automatic: false,
    });
    const retrySnapshot = actor.getSnapshot();
    expect(retrySnapshot.value).toBe("applying");
    expect(registration.waiting.postMessage).toHaveBeenCalledTimes(2);
  });
});
