import { createActor, waitFor } from "xstate";

import { createSpectatorSessionMachine, type SpectatorSessionState } from "@/lib/spectator/v2/sessionMachine";
import type { SpectatorRejoinSnapshot, SpectatorSessionServices } from "@/lib/spectator/v2/types";

jest.setTimeout(15000);

type SpectatorHarness = {
  actor: ReturnType<typeof createActor>;
  getSnapshot: () => SpectatorSessionState;
  waitFor: (predicate: (snapshot: SpectatorSessionState) => boolean) => Promise<SpectatorSessionState>;
  emitRejoinSnapshot: (snapshot: SpectatorRejoinSnapshot) => void;
  consumeInviteCalls: jest.Mock;
  requestRejoinCalls: jest.Mock;
  cancelRejoinCalls: jest.Mock;
  endSessionCalls: jest.Mock;
  sendInviteSuccess: (result: { sessionId: string; mode: "private"; inviteId: string | null }) => void;
  sendInviteFailure: (reason: unknown) => void;
};

const createHarness = (overrides?: Partial<SpectatorSessionServices>): SpectatorHarness => {
  const consumeInvite = overrides?.consumeInvite ?? jest.fn(() => new Promise<never>(() => {}));
  const requestRejoin = overrides?.requestRejoin ?? jest.fn(async () => {});
  const cancelRejoin = overrides?.cancelRejoin ?? jest.fn(async () => {});
  const endSession = overrides?.endSession ?? jest.fn(async () => {});

  const machine = createSpectatorSessionMachine({
    manualInviteResolution: true,
    manualRejoinObservation: true,
    services: {
      consumeInvite,
      requestRejoin,
      cancelRejoin,
      endSession,
      ...overrides,
    },
  });

  const actor = createActor(machine);
  actor.start();

  return {
    actor,
    consumeInviteCalls: consumeInvite,
    requestRejoinCalls: requestRejoin,
    cancelRejoinCalls: cancelRejoin,
    endSessionCalls: endSession,
    getSnapshot: () => actor.getSnapshot() as SpectatorSessionState,
    waitFor: (predicate) =>
      waitFor(actor, (snapshot) => predicate(snapshot as SpectatorSessionState), { timeout: 3000 }) as Promise<
        SpectatorSessionState
      >,
    emitRejoinSnapshot: (snapshot) => actor.send({ type: "REJOIN_SNAPSHOT", snapshot }),
    sendInviteSuccess: (result) => actor.send({ type: "INVITE_CONSUME_SUCCESS", result }),
    sendInviteFailure: (reason) => actor.send({ type: "INVITE_CONSUME_FAILURE", error: reason }),
  };
};

async function reachWatching(harness: SpectatorHarness, inviteId = "invite-1") {
  harness.actor.send({ type: "SESSION_INIT", roomId: "room-1", viewerUid: "viewer-1" });
  await harness.waitFor((snapshot) => snapshot.matches("ready"));

  harness.actor.send({ type: "INVITE_CONSUME", inviteId });
  await harness.waitFor((snapshot) => snapshot.matches("inviting"));
  harness.sendInviteSuccess({ sessionId: "session-123", mode: "private", inviteId });
  const watching = await harness.waitFor((snapshot) => snapshot.matches("watching"));
  expect(watching.context.sessionId).toBe("session-123");
  expect(watching.context.status).toBe("watching");
  return watching;
}

describe("spectatorSessionMachine", () => {
  test("SESSION_INIT → INVITE_CONSUME → done.invoke.consumeInvite で watching 到達", async () => {
    const harness = createHarness();
    try {
      const watching = await reachWatching(harness);
      expect(watching.context.inviteId).toBe("invite-1");
      expect(harness.consumeInviteCalls).toHaveBeenCalledTimes(0);
    } finally {
      harness.actor.stop();
    }
  });

  test("consumeInvite エラーで invitationRejected へ遷移し error を保持", async () => {
    const harness = createHarness();
    try {
      harness.actor.send({ type: "SESSION_INIT", roomId: "room-2", viewerUid: "viewer-9" });
      await harness.waitFor((snapshot) => snapshot.matches("ready"));
      harness.actor.send({ type: "INVITE_CONSUME", inviteId: "invite-error" });
      await harness.waitFor((snapshot) => snapshot.matches("inviting"));
      harness.sendInviteFailure(new Error("invite-expired"));
      const rejected = await harness.waitFor((snapshot) => snapshot.matches("invitationRejected"));
      expect(rejected.context.error).toBe("invite-expired");
      expect(rejected.context.pendingInviteId).toBeNull();
    } finally {
      harness.actor.stop();
    }
  });

  test("REJOIN_SNAPSHOT accepted で rejoinApproved へ遷移", async () => {
    const harness = createHarness();
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "REQUEST_REJOIN", source: "manual" });
      const pending = await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));
      expect(pending.context.status).toBe("rejoinPending");

      const acceptedSnapshot: SpectatorRejoinSnapshot = {
        status: "accepted",
        source: "manual",
        createdAt: Date.now(),
      };
      harness.emitRejoinSnapshot(acceptedSnapshot);
      const approved = await harness.waitFor((snapshot) => snapshot.matches("rejoinApproved"));
      expect(approved.context.rejoinSnapshot).toEqual(acceptedSnapshot);
      expect(approved.context.error).toBeNull();
      expect(approved.context.status).toBe("rejoinApproved");
    } finally {
      harness.actor.stop();
    }
  });

  test("REJOIN_SNAPSHOT rejected で rejoinRejected へ遷移し理由を保持", async () => {
    const harness = createHarness();
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "REQUEST_REJOIN", source: "manual" });
      await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));

      const rejectedSnapshot: SpectatorRejoinSnapshot = {
        status: "rejected",
        source: "manual",
        createdAt: Date.now(),
        reason: "host-denied",
      };
      harness.emitRejoinSnapshot(rejectedSnapshot);
      const rejected = await harness.waitFor((snapshot) => snapshot.matches("rejoinRejected"));
      expect(rejected.context.rejoinSnapshot).toEqual(rejectedSnapshot);
      expect(rejected.context.error).toBe("host-denied");
      expect(rejected.context.status).toBe("rejoinRejected");
    } finally {
      harness.actor.stop();
    }
  });

  test("REJOIN_SNAPSHOT pending では rejoinPending を維持", async () => {
    const harness = createHarness();
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "REQUEST_REJOIN", source: "manual" });
      await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));

      const pendingSnapshot: SpectatorRejoinSnapshot = {
        status: "pending",
        source: "manual",
        createdAt: Date.now(),
      };
      harness.emitRejoinSnapshot(pendingSnapshot);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const snapshot = harness.getSnapshot();
      expect(snapshot.matches("rejoinPending")).toBe(true);
      expect(snapshot.context.rejoinSnapshot).toEqual(pendingSnapshot);
      expect(snapshot.context.error).toBeNull();
    } finally {
      harness.actor.stop();
    }
  });

  test("REJOIN_ACCEPTED 単体イベントでも rejoinApproved へ遷移", async () => {
    const harness = createHarness();
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "REQUEST_REJOIN", source: "manual" });
      await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));

      harness.actor.send({ type: "REJOIN_ACCEPTED" });
      const approved = await harness.waitFor((snapshot) => snapshot.matches("rejoinApproved"));
      expect(approved.context.rejoinSnapshot).toBeNull();
      expect(approved.context.error).toBeNull();
    } finally {
      harness.actor.stop();
    }
  });

  test("REJOIN_REJECTED 単体イベントで理由を反映し rejoinRejected へ遷移", async () => {
    const harness = createHarness();
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "REQUEST_REJOIN", source: "manual" });
      await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));

      harness.actor.send({ type: "REJOIN_REJECTED", reason: "manual-deny" });
      const rejected = await harness.waitFor((snapshot) => snapshot.matches("rejoinRejected"));
      expect(rejected.context.rejoinSnapshot).toBeNull();
      expect(rejected.context.error).toBe("manual-deny");
    } finally {
      harness.actor.stop();
    }
  });
  test("REQUEST_REJOIN invokes service with current session", async () => {
    const requestRejoin = jest.fn(async () => {});
    const harness = createHarness({ requestRejoin });
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "REQUEST_REJOIN", source: "manual" });
      const pending = await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));
      expect(pending.context.status).toBe("rejoinPending");
      expect(requestRejoin).toHaveBeenCalledTimes(1);
      expect(requestRejoin).toHaveBeenCalledWith({
        sessionId: "session-123",
        roomId: "room-1",
        source: "manual",
      });
    } finally {
      harness.actor.stop();
    }
  });

  test("REQUEST_REJOIN after rejection clears error and re-invokes service", async () => {
    const requestRejoin = jest.fn(async () => {});
    const harness = createHarness({ requestRejoin });
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "REQUEST_REJOIN", source: "manual" });
      await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));

      const rejectedSnapshot: SpectatorRejoinSnapshot = {
        status: "rejected",
        source: "manual",
        createdAt: Date.now(),
        reason: "host-busy",
      };
      harness.emitRejoinSnapshot(rejectedSnapshot);
      await harness.waitFor((snapshot) => snapshot.matches("rejoinRejected"));
      expect(harness.getSnapshot().context.error).toBe("host-busy");

      harness.actor.send({ type: "REQUEST_REJOIN", source: "auto" });
      const pendingAgain = await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));
      expect(pendingAgain.context.error).toBeNull();
      expect(pendingAgain.context.rejoinSnapshot).toBeNull();
      expect(requestRejoin).toHaveBeenCalledTimes(2);
      expect(requestRejoin).toHaveBeenLastCalledWith({
        sessionId: "session-123",
        roomId: "room-1",
        source: "auto",
      });
    } finally {
      harness.actor.stop();
    }
  });

  test("SESSION_END moves to ended state and calls endSession service", async () => {
    const endSession = jest.fn(async () => {});
    const harness = createHarness({ endSession });
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "SESSION_END", reason: "host-reset" });
      const ended = await harness.waitFor((snapshot) => snapshot.matches("ended"));
      expect(ended.context.status).toBe("ended");
      expect(ended.context.error).toBe("host-reset");
      expect(endSession).toHaveBeenCalledTimes(1);
      expect(endSession).toHaveBeenCalledWith({
        sessionId: "session-123",
        roomId: "room-1",
        reason: "host-reset",
      });
    } finally {
      harness.actor.stop();
    }
  });

  test("SESSION_ERROR during rejoinPending moves to ended with error message", async () => {
    const harness = createHarness();
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "REQUEST_REJOIN", source: "manual" });
      await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));

      harness.actor.send({ type: "SESSION_ERROR", error: new Error("snapshot-failed") });
      const ended = await harness.waitFor((snapshot) => snapshot.matches("ended"));
      expect(ended.context.status).toBe("ended");
      expect(ended.context.error).toBe("snapshot-failed");
    } finally {
      harness.actor.stop();
    }
  });

  test("leaving rejoinApproved invokes cancelRejoin service", async () => {
    const cancelRejoin = jest.fn(async () => {});
    const harness = createHarness({ cancelRejoin });
    try {
      await reachWatching(harness);
      harness.actor.send({ type: "REQUEST_REJOIN", source: "manual" });
      await harness.waitFor((snapshot) => snapshot.matches("rejoinPending"));

      const acceptedSnapshot: SpectatorRejoinSnapshot = {
        status: "accepted",
        source: "manual",
        createdAt: Date.now(),
      };
      harness.emitRejoinSnapshot(acceptedSnapshot);
      await harness.waitFor((snapshot) => snapshot.matches("rejoinApproved"));

      harness.actor.send({ type: "SESSION_END", reason: "host-reset" });
      await harness.waitFor((snapshot) => snapshot.matches("ended"));

      expect(cancelRejoin).toHaveBeenCalledTimes(1);
      expect(cancelRejoin).toHaveBeenCalledWith({
        sessionId: "session-123",
        roomId: "room-1",
      });
    } finally {
      harness.actor.stop();
    }
  });
});

