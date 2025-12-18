import { expect, test } from "@playwright/test";
import { POST } from "../app/api/rooms/[roomId]/reset/route";

const ROOM_ID = "room-reset-spec";
const CLIENT_VERSION = "dev";
const originalNodeEnv = process.env.NODE_ENV;

const buildRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => ({ clientVersion: CLIENT_VERSION, ...body }),
  }) as any;

declare global {
  // eslint-disable-next-line no-var
  var __setResetRouteOverrides:
    | ((overrides: Record<string, unknown> | null) => void)
    | undefined;
}

const setOverrides = (overrides: Record<string, unknown> | null) => {
  const setter = globalThis.__setResetRouteOverrides;
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

test.describe("rooms reset API route", () => {
  test("returns 401 when token verification fails", async () => {
    setOverrides({
      guard: async () => ({ ok: true, roomVersion: null, serverVersion: null }),
      resetCommand: async () => {
        const error = new Error("unauthorized") as Error & { code?: string };
        error.code = "unauthorized";
        throw error;
      },
    });

    const response = await POST(
      buildRequest({ token: "bad-token" }) as any,
      { params: { roomId: ROOM_ID } }
    );

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("unauthorized");
  });

  test("passes recallSpectators=true to reset command", async () => {
    const calls: Array<{ roomId: string; recallSpectators: boolean; requestId: string | null }> = [];
    setOverrides({
      guard: async () => ({ ok: true, roomVersion: null, serverVersion: null }),
      resetCommand: async (params: any) => {
        calls.push({
          roomId: params.roomId,
          recallSpectators: params.recallSpectators,
          requestId: params.requestId ?? null,
        });
        return {
          roomId: params.roomId,
          statusVersion: 1,
          room: {
            status: "waiting",
            topic: null,
            topicBox: null,
            round: 0,
            ui: { recallOpen: params.recallSpectators, roundPreparing: false, revealPending: false },
          },
          meta: { source: "api", command: "reset", requestId: params.requestId ?? null, ts: 0 },
        };
      },
    });

    const response = await POST(
      buildRequest({ token: "valid-token", recallSpectators: true }) as any,
      { params: { roomId: ROOM_ID } }
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(calls).toEqual([{ roomId: ROOM_ID, recallSpectators: true, requestId: null }]);
    expect(json.sync?.room?.ui?.recallOpen).toBe(true);
  });

  test("defaults recallSpectators=true when option omitted", async () => {
    const calls: Array<{ recallSpectators: boolean }> = [];
    setOverrides({
      guard: async () => ({ ok: true, roomVersion: null, serverVersion: null }),
      resetCommand: async (params: any) => {
        calls.push({ recallSpectators: params.recallSpectators });
        return {
          roomId: params.roomId,
          statusVersion: 1,
          room: { status: "waiting", ui: { recallOpen: params.recallSpectators } },
          meta: { source: "api", command: "reset" },
        };
      },
    });

    const response = await POST(buildRequest({ token: "valid-token" }) as any, {
      params: { roomId: ROOM_ID },
    });

    expect(response.status).toBe(200);
    expect(calls).toEqual([{ recallSpectators: true }]);
  });

  test("passes recallSpectators=false to reset command", async () => {
    const calls: Array<{ recallSpectators: boolean }> = [];
    setOverrides({
      guard: async () => ({ ok: true, roomVersion: null, serverVersion: null }),
      resetCommand: async (params: any) => {
        calls.push({ recallSpectators: params.recallSpectators });
        return {
          roomId: params.roomId,
          statusVersion: 1,
          room: { status: "waiting", ui: { recallOpen: params.recallSpectators } },
          meta: { source: "api", command: "reset" },
        };
      },
    });

    const response = await POST(
      buildRequest({ token: "valid-token", recallSpectators: false }) as any,
      { params: { roomId: ROOM_ID } }
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(calls).toEqual([{ recallSpectators: false }]);
    expect(json.sync?.room?.ui?.recallOpen).toBe(false);
  });
});
