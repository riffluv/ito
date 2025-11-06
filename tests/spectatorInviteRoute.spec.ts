import { expect, test } from "@playwright/test";

import { POST } from "../app/api/spectator/invites/route";

const originalNodeEnv = process.env.NODE_ENV;

const buildRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
  }) as any;

declare global {
  // eslint-disable-next-line no-var
  var __setSpectatorInviteRouteOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
}

const setOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorInviteRouteOverrides;
  if (typeof setter === "function") {
    setter(overrides as any);
  }
};

test.beforeEach(() => {
  process.env.NODE_ENV = "test";
});

test.afterEach(() => {
  setOverrides(null);
});

test.afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

test.describe("spectator invite API route", () => {
  test("returns 401 when token verification fails", async () => {
    setOverrides({
      auth: {
        verifyIdToken: async () => {
          throw new Error("invalid-token");
        },
      },
    });

    const res = await POST(
      buildRequest({ token: "bad", roomId: "room-1" }) as any
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  test("rejects when requester is not host", async () => {
    setOverrides({
      auth: {
        verifyIdToken: async () => ({ uid: "user-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "rooms") {
            return {
              doc: () => ({
                get: async () => ({
                  exists: true,
                  data: () => ({ hostId: "host-999", creatorId: "creator-1" }),
                }),
              }),
            };
          }
          if (name === "spectatorInvites") {
            return {
              doc: () => ({
                set: async () => {
                  throw new Error("should-not-set");
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await POST(
      buildRequest({ token: "valid-token", roomId: "room-2" }) as any
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  test("creates invite and returns payload", async () => {
    let createdPayload: Record<string, unknown> | null = null;

    setOverrides({
      auth: {
        verifyIdToken: async () => ({ uid: "host-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "rooms") {
            return {
              doc: () => ({
                get: async () => ({
                  exists: true,
                  data: () => ({ hostId: "host-1", creatorId: "creator-9" }),
                }),
              }),
            };
          }
          if (name === "spectatorInvites") {
            return {
              doc: () => ({
                set: async (payload: Record<string, unknown>) => {
                  createdPayload = payload;
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
      randomId: () => "invite-fixed",
      now: () => 1700000000000,
    });

    const res = await POST(
      buildRequest({
        token: "valid",
        roomId: "room-9",
        mode: "public",
        maxUses: 3,
        expiresInMinutes: 30,
        flags: { ticketRequired: true },
      }) as any
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      invite: {
        id: string;
        roomId: string;
        mode: string;
        maxUses: number | null;
        expiresAt: number | null;
        flags: Record<string, unknown> | null;
      };
    };
    expect(json.ok).toBe(true);
    expect(json.invite.id).toBe("invite-fixed");
    expect(json.invite.roomId).toBe("room-9");
    expect(json.invite.mode).toBe("public");
    expect(json.invite.maxUses).toBe(3);
    expect(json.invite.expiresAt).toBe(1700000000000 + 30 * 60 * 1000);
    expect(json.invite.flags).toEqual({ ticketRequired: true });

    expect(createdPayload).toBeTruthy();
    expect(createdPayload?.roomId).toBe("room-9");
    expect(createdPayload?.mode).toBe("public");
    expect(createdPayload?.maxUses).toBe(3);
    expect(createdPayload?.issuerUid).toBe("host-1");
    expect(typeof createdPayload?.createdAt).toBe("object");
    expect(typeof createdPayload?.updatedAt).toBe("object");

    const expiresAt = createdPayload?.expiresAt as {
      toMillis?: () => number;
    };
    expect(expiresAt?.toMillis?.()).toBe(1700000000000 + 30 * 60 * 1000);

    const flags = createdPayload?.flags as Record<string, unknown> | undefined;
    expect(flags?.ticketRequired).toBe(true);
  });

  test("returns 400 for invalid maxUses", async () => {
    setOverrides({
      auth: {
        verifyIdToken: async () => ({ uid: "host-1", admin: false }),
      },
      db: {
        collection: (name: string) => {
          if (name === "rooms") {
            return {
              doc: () => ({
                get: async () => ({
                  exists: true,
                  data: () => ({ hostId: "host-1", creatorId: "creator-9" }),
                }),
              }),
            };
          }
          if (name === "spectatorInvites") {
            return {
              doc: () => ({
                set: async () => {
                  throw new Error("should-not-set");
                },
              }),
            };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    });

    const res = await POST(
      buildRequest({
        token: "valid",
        roomId: "room-9",
        maxUses: 0,
      }) as any
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_max_uses");
  });
});

