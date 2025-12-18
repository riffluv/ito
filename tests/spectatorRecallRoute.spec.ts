import { expect, test } from "@playwright/test";

import { POST } from "../app/api/rooms/[roomId]/spectators/recall/route";

const ROOM_ID = "room-spectator-recall-spec";
const CLIENT_VERSION = "dev";
const originalNodeEnv = process.env.NODE_ENV;

const buildRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
  }) as any;

declare global {
  // eslint-disable-next-line no-var
  var __setSpectatorRecallRouteOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
}

const setOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setSpectatorRecallRouteOverrides;
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

test.describe("spectator recall API route", () => {
  test("returns 401 when token verification fails", async () => {
    setOverrides({
      auth: {
        verifyIdToken: async () => {
          throw new Error("bad-token");
        },
      } as any,
      db: {
        collection: () => ({
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({
                hostId: "host-1",
                creatorId: "creator-9",
                status: "waiting",
              }),
            }),
          }),
        }),
      } as any,
    });

    const response = await POST(
      buildRequest({ token: "bad-token", clientVersion: CLIENT_VERSION }) as any,
      {
      params: { roomId: ROOM_ID },
      }
    );

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("unauthorized");
  });

  test("returns 403 when caller is not host/creator/admin", async () => {
    setOverrides({
      auth: {
        verifyIdToken: async () => ({ uid: "guest-1", admin: false }),
      } as any,
      db: {
        collection: () => ({
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({
                hostId: "host-1",
                creatorId: "creator-9",
                status: "waiting",
              }),
            }),
          }),
        }),
      } as any,
    });

    const response = await POST(
      buildRequest({ token: "valid-token", clientVersion: CLIENT_VERSION }) as any,
      {
      params: { roomId: ROOM_ID },
      }
    );

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("forbidden");
  });

  test("returns 409 when room is not waiting", async () => {
    setOverrides({
      auth: {
        verifyIdToken: async () => ({ uid: "host-1", admin: false }),
      } as any,
      db: {
        collection: () => ({
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({
                hostId: "host-1",
                creatorId: "creator-9",
                status: "clue",
              }),
            }),
          }),
        }),
      } as any,
    });

    const response = await POST(
      buildRequest({ token: "valid-token", clientVersion: CLIENT_VERSION }) as any,
      {
      params: { roomId: ROOM_ID },
      }
    );

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("not_waiting");
  });

  test("opens recall window when caller is authorized", async () => {
    let updatedPayload: any = null;
    setOverrides({
      auth: {
        verifyIdToken: async () => ({ uid: "host-1", admin: false }),
      } as any,
      db: {
        collection: () => ({
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({
                hostId: "host-1",
                creatorId: "creator-9",
                status: "waiting",
              }),
            }),
            update: async (payload: any) => {
              updatedPayload = payload;
            },
          }),
        }),
      } as any,
    });

    const response = await POST(
      buildRequest({ token: "valid-token", clientVersion: CLIENT_VERSION }) as any,
      {
      params: { roomId: ROOM_ID },
      }
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(updatedPayload).toBeTruthy();
    expect(updatedPayload["ui.recallOpen"]).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(updatedPayload, "lastActiveAt")).toBe(true);
  });
});
