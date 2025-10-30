import { expect, test } from "@playwright/test";
import {
  POST,
  __setTestOverridesForResetRoute,
} from "../app/api/rooms/[roomId]/reset/route";

const ROOM_ID = "room-reset-spec";
const originalNodeEnv = process.env.NODE_ENV;

const buildRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
  }) as any;

test.beforeEach(() => {
  process.env.NODE_ENV = "test";
});

test.afterEach(() => {
  __setTestOverridesForResetRoute(null);
});

test.afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

test.describe("rooms reset API route", () => {
  test("returns 401 when token verification fails", async () => {
    __setTestOverridesForResetRoute({
      auth: {
        verifyIdToken: async () => {
          throw new Error("bad-token");
        },
      } as any,
    });

    const response = await POST(
      buildRequest({ token: "bad-token" }) as any,
      { params: { roomId: ROOM_ID } }
    );

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("unauthorized");
  });

  test("updates recallOpen=true via compose payload", async () => {
    let updatedPayload: any = null;
    __setTestOverridesForResetRoute({
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
      buildRequest({ token: "valid-token", recallSpectators: true }) as any,
      { params: { roomId: ROOM_ID } }
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(updatedPayload).toBeTruthy();
    expect(updatedPayload.status).toBe("waiting");
    expect(updatedPayload["ui.recallOpen"]).toBe(true);
    expect(updatedPayload.round).toBe(0);
    expect(updatedPayload.topic).toBeNull();
  });

  test("updates recallOpen=false when option is false", async () => {
    let updatedPayload: any = null;
    __setTestOverridesForResetRoute({
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
      buildRequest({ token: "valid-token", recallSpectators: false }) as any,
      { params: { roomId: ROOM_ID } }
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(updatedPayload).toBeTruthy();
    expect(updatedPayload["ui.recallOpen"]).toBe(false);
  });
});
