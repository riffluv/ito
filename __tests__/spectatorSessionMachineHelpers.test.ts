import type { SpectatorSessionContext } from "@/lib/spectator/v2/types";
import {
  applyInviteConsumeFailure,
  applyInviteConsumeSuccess,
  extractInviteConsumeFailureMessage,
  extractInviteConsumeResult,
  isRejoinSnapshotStatus,
} from "@/lib/spectator/v2/sessionMachine/helpers";

describe("spectator sessionMachine helpers", () => {
  const baseContext: SpectatorSessionContext = {
    roomId: "room-1",
    sessionId: null,
    viewerUid: "viewer",
    inviteId: null,
    status: "idle",
    mode: null,
    error: null,
    rejoinSnapshot: null,
    flags: { ticketRequired: true },
    telemetry: {},
    pendingInviteId: "inv-1",
  };

  test("extractInviteConsumeResult supports invoke done and manual success", () => {
    expect(
      extractInviteConsumeResult({
        type: "done.invoke.consumeInvite",
        data: { sessionId: "s1", mode: "private", inviteId: "i1" },
      } as any)
    ).toEqual({ sessionId: "s1", mode: "private", inviteId: "i1" });

    expect(
      extractInviteConsumeResult({
        type: "INVITE_CONSUME_SUCCESS",
        result: { sessionId: "s2", mode: "public", inviteId: null },
      } as any)
    ).toEqual({ sessionId: "s2", mode: "public", inviteId: null });

    expect(extractInviteConsumeResult({ type: "RESET" } as any)).toBeNull();
  });

  test("applyInviteConsumeSuccess sets watching state and merges flags", () => {
    const next = applyInviteConsumeSuccess(baseContext, {
      sessionId: "s1",
      mode: "private",
      inviteId: "i1",
      flags: { inviteOnly: true },
    });
    expect(next.sessionId).toBe("s1");
    expect(next.inviteId).toBe("i1");
    expect(next.mode).toBe("private");
    expect(next.status).toBe("watching");
    expect(next.error).toBeNull();
    expect(next.pendingInviteId).toBeNull();
    expect(next.flags).toEqual({ ticketRequired: true, inviteOnly: true });
  });

  test("extractInviteConsumeFailureMessage covers common sources", () => {
    expect(
      extractInviteConsumeFailureMessage({
        type: "error.platform.consumeInvite",
        data: new Error("boom"),
      } as any)
    ).toBe("boom");

    expect(
      extractInviteConsumeFailureMessage({
        type: "INVITE_CONSUME_FAILURE",
        error: "nope",
      } as any)
    ).toBe("nope");

    expect(
      extractInviteConsumeFailureMessage({
        type: "INVITE_CONSUME_FAILURE",
        error: { message: "from-object" },
      } as any)
    ).toBe("from-object");

    expect(
      extractInviteConsumeFailureMessage({
        type: "INVITE_CONSUME_FAILURE",
        reason: "from-reason",
      } as any)
    ).toBe("from-reason");
  });

  test("applyInviteConsumeFailure sets invitationRejected and default error", () => {
    const next = applyInviteConsumeFailure(baseContext, null);
    expect(next.status).toBe("invitationRejected");
    expect(next.error).toBe("invite-rejected");
    expect(next.pendingInviteId).toBeNull();
  });

  test("isRejoinSnapshotStatus uses event snapshot when provided, else context snapshot", () => {
    const acceptedCtx = { ...baseContext, rejoinSnapshot: { status: "accepted", source: "auto", createdAt: null } as any };
    expect(
      isRejoinSnapshotStatus({
        context: acceptedCtx,
        event: { type: "RESET" } as any,
        status: "accepted",
      })
    ).toBe(true);

    expect(
      isRejoinSnapshotStatus({
        context: acceptedCtx,
        event: { type: "REJOIN_SNAPSHOT", snapshot: { status: "rejected", source: "auto", createdAt: null } as any } as any,
        status: "accepted",
      })
    ).toBe(false);

    // event snapshot null => falls back to context snapshot (matches machine semantics)
    expect(
      isRejoinSnapshotStatus({
        context: acceptedCtx,
        event: { type: "REJOIN_SNAPSHOT", snapshot: null } as any,
        status: "accepted",
      })
    ).toBe(true);
  });
});

