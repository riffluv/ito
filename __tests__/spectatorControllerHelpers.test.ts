import {
  deriveSeatRequestButtonDisabled,
  deriveSeatRequestError,
  deriveSeatRequestViewState,
  deriveSpectatorReason,
} from "@/lib/spectator/v2/useSpectatorController/helpers";

describe("useSpectatorController helpers", () => {
  const baseMachineState = {
    status: "idle",
    node: "idle",
    reason: "none",
    requestSource: null,
    requestStatus: "idle",
    requestCreatedAt: null,
    requestFailure: null,
    error: null,
  } as any;

  const baseSession = {
    status: "watching",
    sessionId: "s1",
    error: null,
    rejoinSnapshot: null,
    actions: { requestRejoin: () => {} },
  } as any;

  test("deriveSpectatorReason returns null when not spectator", () => {
    expect(
      deriveSpectatorReason({ isSpectatorMode: false, spectatorMachineStateReason: "none" as any })
    ).toBeNull();
  });

  test("deriveSeatRequestError prioritizes rejection reason", () => {
    const spectatorSession = {
      ...baseSession,
      status: "rejoinRejected",
      error: "session-error",
      rejoinSnapshot: { status: "rejected", source: "manual", createdAt: 1, reason: "nope" },
    };
    const spectatorMachineState = {
      ...baseMachineState,
      requestFailure: "machine-failure",
      error: "machine-error",
    };
    expect(
      deriveSeatRequestError({
        spectatorSessionStatus: spectatorSession.status,
        spectatorSessionError: spectatorSession.error,
        spectatorSessionRejoinSnapshot: spectatorSession.rejoinSnapshot,
        spectatorMachineError: spectatorMachineState.error,
        spectatorMachineRequestFailure: spectatorMachineState.requestFailure,
      })
    ).toBe("nope");
  });

  test("deriveSeatRequestError fallback order differs between rejected and others", () => {
    const rejectedSession = {
      ...baseSession,
      status: "rejoinRejected",
      error: "session-error",
      rejoinSnapshot: { status: "rejected", source: "manual", createdAt: 1, reason: null },
    };
    const spectatorMachineState = {
      ...baseMachineState,
      requestFailure: "machine-failure",
      error: "machine-error",
    };
    expect(
      deriveSeatRequestError({
        spectatorSessionStatus: rejectedSession.status,
        spectatorSessionError: rejectedSession.error,
        spectatorSessionRejoinSnapshot: rejectedSession.rejoinSnapshot,
        spectatorMachineError: spectatorMachineState.error,
        spectatorMachineRequestFailure: spectatorMachineState.requestFailure,
      })
    ).toBe("session-error");

    const nonRejectedSession = { ...baseSession, status: "watching", error: null };
    expect(
      deriveSeatRequestError({
        spectatorSessionStatus: nonRejectedSession.status,
        spectatorSessionError: nonRejectedSession.error,
        spectatorSessionRejoinSnapshot: nonRejectedSession.rejoinSnapshot,
        spectatorMachineError: spectatorMachineState.error,
        spectatorMachineRequestFailure: spectatorMachineState.requestFailure,
      })
    ).toBe("machine-error");
  });

  test("deriveSeatRequestViewState status/source/requestedAt precedence", () => {
    const spectatorSession = {
      ...baseSession,
      status: "rejoinApproved",
      rejoinSnapshot: { status: "accepted", source: "auto", createdAt: 11 },
    };
    const spectatorMachineState = {
      ...baseMachineState,
      requestSource: "button",
      requestCreatedAt: 22,
    };
    const view = deriveSeatRequestViewState({
      spectatorSessionStatus: spectatorSession.status,
      spectatorSessionRejoinSnapshot: spectatorSession.rejoinSnapshot,
      spectatorMachineRequestSource: spectatorMachineState.requestSource,
      spectatorMachineRequestCreatedAt: spectatorMachineState.requestCreatedAt,
      pendingSeatRequest: "shortcut",
      lastRequestAt: 33,
      seatRequestError: null,
    });
    expect(view.status).toBe("accepted");
    expect(view.source).toBe("auto");
    expect(view.requestedAt).toBe(11);
  });

  test("deriveSeatRequestViewState falls back to pending source and lastRequestAt", () => {
    const spectatorSession = { ...baseSession, status: "watching", rejoinSnapshot: null };
    const spectatorMachineState = { ...baseMachineState, requestSource: null, requestCreatedAt: null };
    const view = deriveSeatRequestViewState({
      spectatorSessionStatus: spectatorSession.status,
      spectatorSessionRejoinSnapshot: spectatorSession.rejoinSnapshot,
      spectatorMachineRequestSource: spectatorMachineState.requestSource,
      spectatorMachineRequestCreatedAt: spectatorMachineState.requestCreatedAt,
      pendingSeatRequest: "button",
      lastRequestAt: 123,
      seatRequestError: "err",
    });
    expect(view.status).toBe("idle");
    expect(view.source).toBe("button");
    expect(view.requestedAt).toBe(123);
    expect(view.error).toBe("err");
  });

  test("deriveSeatRequestButtonDisabled matches current rule", () => {
    expect(
      deriveSeatRequestButtonDisabled({
        versionMismatchBlocksAccess: true,
        seatRequestPending: false,
        seatAcceptanceActive: false,
        spectatorSessionId: "s1",
      })
    ).toBe(true);
    expect(
      deriveSeatRequestButtonDisabled({
        versionMismatchBlocksAccess: false,
        seatRequestPending: true,
        seatAcceptanceActive: false,
        spectatorSessionId: "s1",
      })
    ).toBe(true);
    expect(
      deriveSeatRequestButtonDisabled({
        versionMismatchBlocksAccess: false,
        seatRequestPending: false,
        seatAcceptanceActive: true,
        spectatorSessionId: "s1",
      })
    ).toBe(true);
    expect(
      deriveSeatRequestButtonDisabled({
        versionMismatchBlocksAccess: false,
        seatRequestPending: false,
        seatAcceptanceActive: false,
        spectatorSessionId: null,
      })
    ).toBe(true);
    expect(
      deriveSeatRequestButtonDisabled({
        versionMismatchBlocksAccess: false,
        seatRequestPending: false,
        seatAcceptanceActive: false,
        spectatorSessionId: "s1",
      })
    ).toBe(false);
  });
});
