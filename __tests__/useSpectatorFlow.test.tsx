import { act, renderHook } from "@testing-library/react";

import {
  useSpectatorFlow,
  type SpectatorMachineState,
} from "@/lib/hooks/useSpectatorFlow";
import { cancelSeatRequest } from "@/lib/game/service";
import { traceAction } from "@/lib/utils/trace";

jest.mock("@/lib/game/service", () => ({
  cancelSeatRequest: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/utils/trace", () => ({
  traceAction: jest.fn(),
}));

const traceActionMock = traceAction as jest.MockedFunction<typeof traceAction>;

const baseMachineState: SpectatorMachineState = {
  status: "watching",
  node: "watching",
  reason: null,
  requestSource: null,
  requestStatus: "idle",
  requestCreatedAt: null,
  requestFailure: null,
  error: null,
};

const createHook = (
  overrides?: Partial<SpectatorMachineState>,
  options?: { uid?: string | null }
) => {
  const resolvedUid =
    options && Object.prototype.hasOwnProperty.call(options, "uid")
      ? options.uid ?? null
      : "user-1";
  const rejoinKey = resolvedUid
    ? `pendingRejoin:room-test:${resolvedUid}`
    : "pendingRejoin:room-test";
  const suppressKey = resolvedUid
    ? `autoJoinSuppress:room-test:${resolvedUid}`
    : null;
  return renderHook(() =>
    useSpectatorFlow({
      roomId: "room-test",
      uid: resolvedUid,
      rejoinSessionKey: rejoinKey,
      autoJoinSuppressKey: suppressKey,
      isSpectatorMode: true,
      spectatorMachineState: { ...baseMachineState, ...(overrides ?? {}) },
      versionMismatchBlocksAccess: false,
      emitSpectatorEvent: jest.fn(),
      setSeatRequestTimedOut: jest.fn(),
      leavingRef: { current: false },
    })
  );
};

afterEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
});

describe("useSpectatorFlow", () => {
  test("rememberRejoinIntent stores uid in sessionStorage", () => {
    const { result } = createHook();
    act(() => {
      result.current.rememberRejoinIntent();
    });
    expect(
      sessionStorage.getItem("pendingRejoin:room-test:user-1")
    ).toBe("user-1");
  });

  test("queue and consume pending seat request round-trip", () => {
    const { result } = createHook();
    act(() => {
      result.current.queuePendingSeatRequest("manual");
    });
    expect(result.current.hasPendingSeatRequest()).toBe(true);
    let consumed: "manual" | "auto" | null = null;
    act(() => {
      consumed = result.current.consumePendingSeatRequest();
    });
    expect(consumed).toBe("manual");
    expect(result.current.hasPendingSeatRequest()).toBe(false);
  });

  test("cancelSeatRequestSafely triggers service when uid exists", async () => {
    (cancelSeatRequest as jest.Mock).mockResolvedValue(undefined);
    const { result } = createHook();
    let success = false;
    await act(async () => {
      success = await result.current.cancelSeatRequestSafely();
    });
    expect(success).toBe(true);
    expect(cancelSeatRequest).toHaveBeenCalledWith("room-test", "user-1");
  });

  test("cancelSeatRequestSafely short-circuits when uid is missing", async () => {
    const { result } = createHook(undefined, { uid: null });
    let success = true;
    await act(async () => {
      success = await result.current.cancelSeatRequestSafely();
    });
    expect(success).toBe(false);
    expect(cancelSeatRequest).not.toHaveBeenCalled();
  });

  test("handleSeatRecovery blocks when recall is閉じている", async () => {
    const { result } = createHook();
    const notify = jest.fn();
    const requestSeatNow = jest.fn();

    let handled = false;
    await act(async () => {
      handled = await result.current.handleSeatRecovery({
        silent: false,
        source: "manual",
        spectatorRecallEnabled: false,
        roomStatus: "waiting",
        recallOpen: false,
        notify,
        requestSeatNow,
      });
    });

    expect(handled).toBe(true);
    expect(traceActionMock).toHaveBeenCalledWith(
      "spectator.request.intent",
      expect.objectContaining({
        roomId: "room-test",
        uid: "user-1",
        source: "manual",
        canRequestNow: "0",
      })
    );
    expect(traceActionMock).toHaveBeenCalledWith(
      "spectator.request.blocked.recall",
      expect.objectContaining({
        roomId: "room-test",
        uid: "user-1",
        roomStatus: "waiting",
        recallOpen: false,
        silent: "0",
      })
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(requestSeatNow).not.toHaveBeenCalled();
  });

  test("handleSeatRecovery requests seat immediately when recall open", async () => {
    const { result } = createHook();
    const notify = jest.fn();
    const requestSeatNow = jest.fn();

    let handled = false;
    await act(async () => {
      handled = await result.current.handleSeatRecovery({
        silent: false,
        source: "manual",
        spectatorRecallEnabled: true,
        roomStatus: "waiting",
        recallOpen: true,
        notify,
        requestSeatNow,
      });
    });

    expect(handled).toBe(true);
    expect(requestSeatNow).toHaveBeenCalledWith("manual");
    expect(traceActionMock).toHaveBeenCalledWith(
      "spectator.request.intent",
      expect.objectContaining({
        roomId: "room-test",
        uid: "user-1",
        source: "manual",
        canRequestNow: "1",
      })
    );
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
