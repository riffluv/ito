import { expect, test } from "@playwright/test";
import { Timestamp } from "firebase-admin/firestore";

import { POST as sessionRejoin } from "../app/api/spectator/sessions/[sessionId]/rejoin/route";
import { POST as sessionApprove } from "../app/api/spectator/sessions/[sessionId]/approve/route";
import { POST as sessionReject } from "../app/api/spectator/sessions/[sessionId]/reject/route";
import { POST as sessionCancel } from "../app/api/spectator/sessions/[sessionId]/cancel/route";

const originalEnv = process.env.NODE_ENV;

const buildRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
  }) as any;

declare global {
  // eslint-disable-next-line no-var
  var __setSpectatorSessionRejoinOverrides:
    | ((value: Record<string, unknown> | null) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var __setSpectatorSessionApproveOverrides:
    | ((value: Record<string, unknown> | null) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var __setSpectatorSessionRejectOverrides:
    | ((value: Record<string, unknown> | null) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var __setSpectatorSessionCancelOverrides:
    | ((value: Record<string, unknown> | null) => void)
    | undefined;
}

const setRejoinOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionRejoinOverrides;
  if (typeof setter === "function") {
    setter(overrides as any);
  }
};

const setApproveOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionApproveOverrides;
  if (typeof setter === "function") {
    setter(overrides as any);
  }
};

const setRejectOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionRejectOverrides;
  if (typeof setter === "function") {
    setter(overrides as any);
  }
};

const setCancelOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorSessionCancelOverrides;
  if (typeof setter === "function") {
    setter(overrides as any);
  }
};

test.beforeEach(() => {
  process.env.NODE_ENV = "test";
});

test.afterEach(() => {
  setRejoinOverrides(null);
  setApproveOverrides(null);
  setRejectOverrides(null);
  setCancelOverrides(null);
});

test.afterAll(() => {
  process.env.NODE_ENV = originalEnv;
});

test.describe("spectator host approval flow", () => {
  test("host approval transitions pending request to rejoinApproved", async () => {
    const now = 1700000100000;
    const sessionStore: Record<string, any> = {
      "session-1": {
        roomId: "room-1",
        viewerUid: "viewer-1",
        status: "watching",
        rejoinRequest: null,
      },
    };
    const roomsStore: Record<string, any> = {
      "room-1": {
        hostId: "host-1",
        creatorId: "host-1",
      },
    };

    setRejoinOverrides({
      now: () => now - 2000,
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
                update: async (payload: Record<string, unknown>) => {
                  sessionStore[id] = { ...(sessionStore[id] ?? {}), ...payload };
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const rejoinRes = await sessionRejoin(
      buildRequest({ token: "viewer-token", roomId: "room-1", source: "manual" }) as any,
      { params: { sessionId: "session-1" } }
    );

    expect(rejoinRes.status).toBe(200);
    expect(sessionStore["session-1"].status).toBe("rejoinPending");

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
                update: async (payload: Record<string, unknown>) => {
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

    const approveRes = await sessionApprove(
      buildRequest({ token: "host-token", roomId: "room-1" }) as any,
      { params: { sessionId: "session-1" } }
    );

    expect(approveRes.status).toBe(200);
    const updated = sessionStore["session-1"];
    expect(updated.status).toBe("rejoinApproved");
    expect((updated.rejoinRequest.resolvedAt as Timestamp).toMillis()).toBe(now);
    expect(updated.rejoinRequest.status).toBe("accepted");
  });

  test("host rejection stores reason and blocks duplicate approvals", async () => {
    const now = 1700000205000;
    const createdAt = Timestamp.fromMillis(now - 1500);
    const sessionStore: Record<string, any> = {
      "session-2": {
        roomId: "room-1",
        viewerUid: "viewer-2",
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
        creatorId: "host-2",
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
                update: async (payload: Record<string, unknown>) => {
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

    const rejectRes = await sessionReject(
      buildRequest({ token: "host-token", roomId: "room-1", reason: "席が埋まっています" }) as any,
      { params: { sessionId: "session-2" } }
    );

    expect(rejectRes.status).toBe(200);
    const rejected = sessionStore["session-2"];
    expect(rejected.status).toBe("rejoinRejected");
    expect(rejected.rejoinRequest.status).toBe("rejected");
    expect((rejected.rejoinRequest.createdAt as Timestamp).toMillis()).toBe(createdAt.toMillis());
    expect(rejected.rejoinRequest.reason).toBe("席が埋まっています");

    setApproveOverrides({
      now: () => now + 500,
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
                update: async (payload: Record<string, unknown>) => {
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

    const duplicateApprove = await sessionApprove(
      buildRequest({ token: "host-token", roomId: "room-1" }) as any,
      { params: { sessionId: "session-2" } }
    );

    expect(duplicateApprove.status).toBe(409);
    const errorJson = await duplicateApprove.json();
    expect(errorJson.error).toBe("rejoin_not_pending");
  });

  test("spectator cancels pending request then reapplies successfully", async () => {
    const baseNow = 1700000300000;
    const sessionStore: Record<string, any> = {
      "session-3": {
        roomId: "room-1",
        viewerUid: "viewer-3",
        status: "watching",
        rejoinRequest: null,
      },
    };
    const roomsStore: Record<string, any> = {
      "room-1": {
        hostId: "host-3",
        creatorId: "host-3",
      },
    };

    setRejoinOverrides({
      now: () => baseNow,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-3", admin: false }),
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

    const firstRequest = await sessionRejoin(
      buildRequest({ token: "viewer-token", roomId: "room-1", source: "manual" }) as any,
      { params: { sessionId: "session-3" } }
    );

    expect(firstRequest.status).toBe(200);
    expect(sessionStore["session-3"].status).toBe("rejoinPending");
    const initialRejoin = sessionStore["session-3"].rejoinRequest as Record<string, unknown>;
    expect(initialRejoin.status).toBe("pending");
    expect(initialRejoin.source).toBe("manual");
    expect((initialRejoin.createdAt as Timestamp).toMillis()).toBe(baseNow);

    setCancelOverrides({
      now: () => baseNow + 500,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-3", admin: false }),
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
      buildRequest({ token: "viewer-token", roomId: "room-1" }) as any,
      { params: { sessionId: "session-3" } }
    );

    expect(cancelRes.status).toBe(200);
    expect(sessionStore["session-3"].status).toBe("watching");
    expect(sessionStore["session-3"].rejoinRequest).toBeNull();

    setRejoinOverrides({
      now: () => baseNow + 1200,
      auth: {
        verifyIdToken: async () => ({ uid: "viewer-3", admin: false }),
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

    const secondRequest = await sessionRejoin(
      buildRequest({ token: "viewer-token", roomId: "room-1", source: "auto" }) as any,
      { params: { sessionId: "session-3" } }
    );

    expect(secondRequest.status).toBe(200);
    expect(sessionStore["session-3"].status).toBe("rejoinPending");
    const secondRejoin = sessionStore["session-3"].rejoinRequest as Record<string, unknown>;
    expect(secondRejoin.status).toBe("pending");
    expect(secondRejoin.source).toBe("auto");
    expect((secondRejoin.createdAt as Timestamp).toMillis()).toBe(baseNow + 1200);

    setApproveOverrides({
      now: () => baseNow + 2200,
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

    const approveRes = await sessionApprove(
      buildRequest({ token: "host-token", roomId: "room-1" }) as any,
      { params: { sessionId: "session-3" } }
    );

    expect(approveRes.status).toBe(200);
    const resolved = sessionStore["session-3"];
    expect(resolved.status).toBe("rejoinApproved");
    const resolvedRejoin = resolved.rejoinRequest as Record<string, unknown>;
    expect(resolvedRejoin.status).toBe("accepted");
    expect((resolvedRejoin.createdAt as Timestamp).toMillis()).toBe(baseNow + 1200);
    expect((resolvedRejoin.resolvedAt as Timestamp).toMillis()).toBe(baseNow + 2200);
    expect(resolvedRejoin.resolvedBy).toBe("host-3");
  });
});
