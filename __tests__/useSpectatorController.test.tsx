import { renderHook } from "@testing-library/react";

import { useSpectatorController } from "@/lib/spectator/v2/useSpectatorController";
import {
  useSpectatorFlow,
  type UseSpectatorFlowResult,
} from "@/lib/hooks/useSpectatorFlow";

jest.mock("@/lib/hooks/useSpectatorFlow", () => {
  const actual = jest.requireActual("@/lib/hooks/useSpectatorFlow");
  return {
    ...actual,
    useSpectatorFlow: jest.fn(),
  };
});

const mockUseSpectatorFlow = useSpectatorFlow as jest.MockedFunction<
  typeof useSpectatorFlow
>;

const baseFlowResult = (overrides?: Partial<UseSpectatorFlowResult>): UseSpectatorFlowResult => ({
  spectatorReason: "waiting-open",
  seatRequestSource: "manual",
  seatRequestPending: false,
  seatRequestAccepted: false,
  seatRequestRejected: false,
  seatAcceptanceActive: false,
  seatRequestState: {
    status: "idle",
    source: "manual",
    requestedAt: 0,
    error: null,
  },
  seatRequestButtonDisabled: false,
  rememberRejoinIntent: jest.fn(),
  clearRejoinIntent: jest.fn(),
  hasRejoinIntent: jest.fn().mockReturnValue(false),
  clearAutoJoinSuppress: jest.fn(),
  suppressAutoJoinIntent: jest.fn(),
  queuePendingSeatRequest: jest.fn(),
  clearPendingSeatRequest: jest.fn(),
  consumePendingSeatRequest: jest.fn().mockReturnValue(null),
  hasPendingSeatRequest: jest.fn().mockReturnValue(false),
  markSeatRequestIntent: jest.fn(),
  handleSeatRecovery: jest.fn(),
  cancelSeatRequestSafely: jest.fn(),
  ...overrides,
});

const defaultParams = {
  roomId: "room-test",
  uid: "user-1",
  rejoinSessionKey: "pendingRejoin:room-test:user-1",
  autoJoinSuppressKey: "autoJoinSuppress:room-test:user-1",
  isSpectatorMode: true,
  spectatorMachineState: {
    status: "watching" as const,
    node: "watching" as const,
    reason: "waiting-open" as const,
    requestSource: "manual" as const,
    requestStatus: "idle" as const,
    requestCreatedAt: null,
    requestFailure: null,
    error: null,
  },
  versionMismatchBlocksAccess: false,
  emitSpectatorEvent: jest.fn(),
  setSeatRequestTimedOut: jest.fn(),
  leavingRef: { current: false } as { current: boolean },
};

afterEach(() => {
  jest.clearAllMocks();
});

describe("useSpectatorController", () => {
  test("maps flow state to controller state", () => {
    const flow = baseFlowResult();
    mockUseSpectatorFlow.mockReturnValue(flow);

    const { result } = renderHook(() => useSpectatorController(defaultParams));

    expect(result.current.state.reason).toBe(flow.spectatorReason);
    expect(result.current.state.seatRequest).toBe(flow.seatRequestState);
    expect(result.current.state.seatRequestPending).toBe(flow.seatRequestPending);
    expect(result.current.state.seatRequestAccepted).toBe(flow.seatRequestAccepted);
    expect(result.current.state.seatRequestRejected).toBe(flow.seatRequestRejected);
    expect(result.current.state.seatAcceptanceActive).toBe(flow.seatAcceptanceActive);
    expect(result.current.state.seatRequestButtonDisabled).toBe(
      flow.seatRequestButtonDisabled
    );
    expect(result.current.state.seatRequestSource).toBe(flow.seatRequestSource);
  });

  test("exposes flow actions and utils", () => {
    const flow = baseFlowResult();
    mockUseSpectatorFlow.mockReturnValue(flow);

    const { result } = renderHook(() => useSpectatorController(defaultParams));

    result.current.actions.rememberRejoinIntent();
    expect(flow.rememberRejoinIntent).toHaveBeenCalled();

    result.current.actions.handleSeatRecovery({
      silent: false,
      source: "manual",
      spectatorRecallEnabled: true,
      roomStatus: "waiting",
      recallOpen: true,
      notify: jest.fn(),
      requestSeatNow: jest.fn(),
    });
    expect(flow.handleSeatRecovery).toHaveBeenCalled();

    result.current.utils.hasRejoinIntent();
    expect(flow.hasRejoinIntent).toHaveBeenCalled();
  });

  test("passes params to useSpectatorFlow", () => {
    const flow = baseFlowResult();
    mockUseSpectatorFlow.mockReturnValue(flow);

    renderHook(() => useSpectatorController(defaultParams));

    expect(mockUseSpectatorFlow).toHaveBeenCalledWith(defaultParams);
  });
});
