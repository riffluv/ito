import { act, renderHook } from "@testing-library/react";

import {
  useSpectatorFlow,
  type SpectatorMachineState,
} from "@/lib/hooks/useSpectatorFlow";
import { cancelSeatRequest } from "@/lib/game/service";

jest.mock("@/lib/game/service", () => ({
  cancelSeatRequest: jest.fn().mockResolvedValue(undefined),
}));

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
      seatAcceptanceHold: false,
      versionMismatchBlocksAccess: false,
      emitSpectatorEvent: jest.fn(),
      clearSeatAcceptanceHold: jest.fn(),
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
});
