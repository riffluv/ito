import { expect, test } from "@playwright/test";
import { Timestamp } from "firebase-admin/firestore";

import { POST as consumeInvite } from "../app/api/spectator/invites/[inviteId]/consume/route";
import { POST as sessionWatch } from "../app/api/spectator/sessions/[sessionId]/watch/route";
import { POST as sessionRejoin } from "../app/api/spectator/sessions/[sessionId]/rejoin/route";
import { POST as sessionCancel } from "../app/api/spectator/sessions/[sessionId]/cancel/route";
import { POST as sessionEnd } from "../app/api/spectator/sessions/[sessionId]/end/route";
import { POST as sessionApprove } from "../app/api/spectator/sessions/[sessionId]/approve/route";
import { POST as sessionReject } from "../app/api/spectator/sessions/[sessionId]/reject/route";

const originalNodeEnv = process.env.NODE_ENV;

const buildRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
  }) as any;

declare global {
  // eslint-disable-next-line no-var
  var __setSpectatorConsumeRouteOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var __setSpectatorSessionWatchOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var __setSpectatorSessionRejoinOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var __setSpectatorSessionCancelOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var __setSpectatorSessionEndOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var __setSpectatorSessionApproveOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var __setSpectatorSessionRejectOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
}

const setConsumeOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorConsumeRouteOverrides;
  if (typeof setter === "function") setter(overrides as any);
};

const setWatchOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionWatchOverrides;
  if (typeof setter === "function") setter(overrides as any);
};

const setRejoinOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionRejoinOverrides;
  if (typeof setter === "function") setter(overrides as any);
};

const setCancelOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionCancelOverrides;
  if (typeof setter === "function") setter(overrides as any);
};

const setEndOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionEndOverrides;
  if (typeof setter === "function") setter(overrides as any);
};

const setApproveOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionApproveOverrides;
  if (typeof setter === "function") setter(overrides as any);
};

const setRejectOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionRejectOverrides;
  if (typeof setter === "function") setter(overrides as any);
};

test.beforeEach(() => {
  process.env.NODE_ENV = "test";
});

test.afterEach(() => {
  setConsumeOverrides(null);
  setWatchOverrides(null);
  setRejoinOverrides(null);
  setCancelOverrides(null);
  setEndOverrides(null);
  setApproveOverrides(null);
  setRejectOverrides(null);
});

test.afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

test.describe("spectator session routes", () => {
  test("consume invite creates session and increments usage", async () => {
    const now = 1700000000000;
    const invites: Record<string, any> = {
      "invite-1": {
        roomId: "room-1",
        mode: "public",
        usedCount: 0,
        maxUses: 2,
        expiresAt: Timestamp.fromMillis(now + 60 * 60 * 1000),
        flags: { ticketRequired: true },
      },
    };
    const sessions: Record<string, any> = {};

    setConsumeOverrides({
      now: () => now,
      randomId: () => "session-consumed",
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorInvites") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!invites[id],
                  data: () => invites[id],
                }),
                update: async (payload: Record<string, any>) => {
                  invites[id] = { ...invites[id], ...payload };
                },
              }),
            };
          }
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessions[id],
                  data: () => sessions[id],
                }),
                set: async (payload: Record<string, any>) => {
                  sessions[id] = { ...payload };
                },
                update: async (payload: Record<string, any>) => {
                  sessions[id] = { ...(sessions[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await consumeInvite(
      buildRequest({ token: "token", roomId: "room-1" }) as any,
      { params: { inviteId: "invite-1" } }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.sessionId).toBe("session-consumed");
    expect(json.mode).toBe("public");
    expect(invites["invite-1"].usedCount).toBe(1);
    expect(sessions["session-consumed"]).toBeTruthy();
    expect(sessions["session-consumed"].viewerUid).toBe("viewer-1");
    expect((sessions["session-consumed"].createdAt as Timestamp).toMillis()).toBe(now);
  });

  test("session watch updates status for owner", async () => {
    const now = 1700000000000;
    const sessionStore: Record<string, any> = {
      "session-1": {
        roomId: "room-1",
        viewerUid: "viewer-1",
        status: "watching",
      },
    };

    setWatchOverrides({
      now: () => now,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await sessionWatch(
      buildRequest({ token: "token", roomId: "room-1" }) as any,
      { params: { sessionId: "session-1" } }
    );

    expect(res.status).toBe(200);
    expect(sessionStore["session-1"].status).toBe("watching");
    expect((sessionStore["session-1"].updatedAt as Timestamp).toMillis()).toBe(now);
  });

  test("session rejoin stores pending request", async () => {
    const now = 1700000000000;
    const sessionStore: Record<string, any> = {
      "session-2": {
        roomId: "room-1",
        viewerUid: "viewer-1",
        status: "watching",
      },
    };

    setRejoinOverrides({
      now: () => now,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await sessionRejoin(
      buildRequest({ token: "token", roomId: "room-1", source: "manual" }) as any,
      { params: { sessionId: "session-2" } }
    );

    expect(res.status).toBe(200);
    expect(sessionStore["session-2"].status).toBe("rejoinPending");
    const request = sessionStore["session-2"].rejoinRequest as Record<string, unknown>;
    expect(request.status).toBe("pending");
    expect(request.source).toBe("manual");
    expect((request.createdAt as Timestamp).toMillis()).toBe(now);
  });

  test("session rejoin rejects mismatched viewer", async () => {
    const now = 1700000005000;
    const sessionStore: Record<string, any> = {
      "session-mismatch": {
        roomId: "room-1",
        viewerUid: "viewer-expected",
        status: "watching",
      },
    };

    setRejoinOverrides({
      now: () => now,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-other", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await sessionRejoin(
      buildRequest({ token: "token", roomId: "room-1", source: "manual" }) as any,
      { params: { sessionId: "session-mismatch" } }
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
    expect(sessionStore["session-mismatch"].status).toBe("watching");
  });

  test("session cancel clears rejoinRequest", async () => {
    const now = 1700000000000;
    const sessionStore: Record<string, any> = {
      "session-3": {
        roomId: "room-1",
        viewerUid: "viewer-1",
        status: "rejoinPending",
        rejoinRequest: { status: "pending" },
      },
    };

    setCancelOverrides({
      now: () => now,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await sessionCancel(
      buildRequest({ token: "token", roomId: "room-1" }) as any,
      { params: { sessionId: "session-3" } }
    );

    expect(res.status).toBe(200);
    expect(sessionStore["session-3"].status).toBe("watching");
    expect(sessionStore["session-3"].rejoinRequest).toBeNull();
  });

  test("session rejoin after cancel creates fresh pending snapshot", async () => {
    const firstNow = 1700000004000;
    const sessionStore: Record<string, any> = {
      "session-3b": {
        roomId: "room-1",
        viewerUid: "viewer-1",
        status: "watching",
        rejoinRequest: null,
      },
    };

    setRejoinOverrides({
      now: () => firstNow,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const firstRejoin = await sessionRejoin(
      buildRequest({ token: "token", roomId: "room-1", source: "manual" }) as any,
      { params: { sessionId: "session-3b" } }
    );

    expect(firstRejoin.status).toBe(200);
    const pending = sessionStore["session-3b"].rejoinRequest as Record<string, unknown>;
    expect((pending.createdAt as Timestamp).toMillis()).toBe(firstNow);
    expect(pending.source).toBe("manual");

    setCancelOverrides({
      now: () => firstNow + 500,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const cancelRes = await sessionCancel(
      buildRequest({ token: "token", roomId: "room-1" }) as any,
      { params: { sessionId: "session-3b" } }
    );
    expect(cancelRes.status).toBe(200);
    expect(sessionStore["session-3b"].rejoinRequest).toBeNull();
    expect(sessionStore["session-3b"].status).toBe("watching");

    const secondNow = firstNow + 1500;
    setRejoinOverrides({
      now: () => secondNow,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const secondRejoin = await sessionRejoin(
      buildRequest({ token: "token", roomId: "room-1", source: "auto" }) as any,
      { params: { sessionId: "session-3b" } }
    );

    expect(secondRejoin.status).toBe(200);
    const pendingAgain = sessionStore["session-3b"].rejoinRequest as Record<string, unknown>;
    expect(pendingAgain.status).toBe("pending");
    expect(pendingAgain.source).toBe("auto");
    expect((pendingAgain.createdAt as Timestamp).toMillis()).toBe(secondNow);
  });

  test("session end updates status and reason", async () => {
    const now = 1700000000000;
    const sessionStore: Record<string, any> = {
      "session-4": {
        roomId: "room-1",
        viewerUid: "viewer-1",
        status: "watching",
      },
    };

    setEndOverrides({
      now: () => now,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await sessionEnd(
      buildRequest({ token: "token", roomId: "room-1", reason: "host-reset" }) as any,
      { params: { sessionId: "session-4" } }
    );

    expect(res.status).toBe(200);
    expect(sessionStore["session-4"].status).toBe("ended");
    expect(sessionStore["session-4"].endReason).toBe("host-reset");
  });

  test("session approve marks rejoin as accepted", async () => {
    const now = 1700000005000;
    const createdAt = Timestamp.fromMillis(now - 5000);
    const sessionStore: Record<string, any> = {
      "session-5": {
        roomId: "room-1",
        viewerUid: "viewer-9",
        status: "rejoinPending",
        rejoinRequest: {
          status: "pending",
          source: "manual",
          createdAt,
        },
      },
    };
    const roomsStore: Record<string, any> = {
      "room-1": {
        hostId: "host-1",
        creatorId: "creator-9",
      },
    };

    setApproveOverrides({
      now: () => now,
      auth: {
        verifyIdToken: async () => ({ uid: "host-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          if (name === "rooms") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!roomsStore[id],
                  data: () => roomsStore[id],
                }),
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await sessionApprove(
      buildRequest({ token: "token", roomId: "room-1" }) as any,
      { params: { sessionId: "session-5" } }
    );

    expect(res.status).toBe(200);
    const updated = sessionStore["session-5"];
    expect(updated.status).toBe("rejoinApproved");
    const rejoin = updated.rejoinRequest as Record<string, unknown>;
    expect(rejoin.status).toBe("accepted");
    expect((rejoin.createdAt as Timestamp).toMillis()).toBe(createdAt.toMillis());
    expect((rejoin.resolvedAt as Timestamp).toMillis()).toBe(now);
    expect(rejoin.resolvedBy).toBe("host-1");
    expect(rejoin.reason).toBeNull();
  });

  test("session reject stores reason and resolved metadata", async () => {
    const now = 1700000010000;
    const createdAt = Timestamp.fromMillis(now - 10000);
    const sessionStore: Record<string, any> = {
      "session-6": {
        roomId: "room-1",
        viewerUid: "viewer-9",
        status: "rejoinPending",
        rejoinRequest: {
          status: "pending",
          source: "auto",
          createdAt,
        },
      },
    };
    const roomsStore: Record<string, any> = {
      "room-1": {
        hostId: "host-2",
        creatorId: "creator-9",
      },
    };

    setRejectOverrides({
      now: () => now,
      auth: {
        verifyIdToken: async () => ({ uid: "host-2", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          if (name === "rooms") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!roomsStore[id],
                  data: () => roomsStore[id],
                }),
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await sessionReject(
      buildRequest({ token: "token", roomId: "room-1", reason: "ホストが拒否しました" }) as any,
      { params: { sessionId: "session-6" } }
    );

    expect(res.status).toBe(200);
    const updated = sessionStore["session-6"];
    expect(updated.status).toBe("rejoinRejected");
    const rejoin = updated.rejoinRequest as Record<string, unknown>;
    expect(rejoin.status).toBe("rejected");
    expect((rejoin.createdAt as Timestamp).toMillis()).toBe(createdAt.toMillis());
    expect((rejoin.resolvedAt as Timestamp).toMillis()).toBe(now);
    expect(rejoin.resolvedBy).toBe("host-2");
    expect(rejoin.reason).toBe("ホストが拒否しました");
  });

  test("session reject truncates long reasons", async () => {
    const now = 1700000210000;
    const createdAt = Timestamp.fromMillis(now - 2500);
    const sessionStore: Record<string, any> = {
      "session-7": {
        roomId: "room-1",
        viewerUid: "viewer-3",
        status: "rejoinPending",
        rejoinRequest: {
          status: "pending",
          source: "manual",
          createdAt,
        },
      },
    };
    const roomsStore: Record<string, any> = {
      "room-1": {
        hostId: "host-3",
        creatorId: "host-3",
      },
    };

    setRejectOverrides({
      now: () => now,
      auth: {
        verifyIdToken: async () => ({ uid: "host-3", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "spectatorSessions") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!sessionStore[id],
                  data: () => sessionStore[id],
                }),
                update: async (payload: Record<string, any>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          if (name === "rooms") {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: !!roomsStore[id],
                  data: () => roomsStore[id],
                }),
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const overlongReason = "理由".repeat(200);
    const res = await sessionReject(
      buildRequest({ token: "token", roomId: "room-1", reason: overlongReason }) as any,
      { params: { sessionId: "session-7" } }
    );

    expect(res.status).toBe(200);
    const updated = sessionStore["session-7"];
    const rejoin = updated.rejoinRequest as Record<string, unknown>;
    expect(rejoin.status).toBe("rejected");
    const storedReason = rejoin.reason as string;
    expect(storedReason.length).toBeLessThanOrEqual(160);
    expect(storedReason).toBe(overlongReason.slice(0, 160));
  });
});
