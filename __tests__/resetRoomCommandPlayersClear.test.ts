let dbMock: any;

const verifyIdTokenMock = jest.fn().mockResolvedValue({ uid: "host-1", admin: false });
const acquireRoomLockMock = jest.fn().mockResolvedValue(true);
const releaseRoomLockMock = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/server/firebaseAdmin", () => ({
  getAdminDb: () => dbMock,
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenMock,
  }),
  getAdminRtdb: () => null,
}));

jest.mock("@/lib/server/roomQueue", () => ({
  acquireRoomLock: (...args: unknown[]) => acquireRoomLockMock(...args),
  releaseRoomLock: (...args: unknown[]) => releaseRoomLockMock(...args),
}));

jest.mock("@/lib/server/roomAudit", () => ({
  logRoomCommandAudit: jest.fn().mockResolvedValue(undefined),
}));

import { resetRoomCommand } from "@/lib/server/roomCommands";

type TxUpdate = { ref: unknown; data: Record<string, unknown> };

function setupDb(params: {
  room: Record<string, unknown>;
  players: string[];
}): { updates: TxUpdate[]; roomRef: unknown; playerRefs: unknown[] } {
  const updates: TxUpdate[] = [];
  const roomRef = { __ref: "roomRef" } as any;
  const playersRef = { __ref: "playersRef" } as any;
  const playerRefs = params.players.map((id) => ({ __ref: `playerRef:${id}` }));

  const roomSnap = {
    exists: true,
    data: () => params.room,
  };

  const playersSnap = {
    size: playerRefs.length,
    forEach: (cb: (doc: { ref: unknown }) => void) => {
      playerRefs.forEach((ref) => cb({ ref }));
    },
  };

  const tx = {
    get: async (ref: unknown) => {
      if (ref === roomRef) return roomSnap;
      if (ref === playersRef) return playersSnap;
      throw new Error("unexpected ref");
    },
    update: (ref: unknown, data: Record<string, unknown>) => {
      updates.push({ ref, data });
    },
  };

  const spectatorQuery = {
    where: () => spectatorQuery,
    get: async () => ({ empty: true, size: 0, forEach: () => {} }),
  };

  roomRef.get = async () => roomSnap;
  roomRef.collection = (sub: string) => {
    if (sub !== "players") throw new Error("unexpected subcollection");
    return playersRef;
  };

  dbMock = {
    collection: (name: string) => {
      if (name === "rooms") {
        return {
          doc: () => roomRef,
        };
      }
      if (name === "spectatorSessions") {
        return spectatorQuery;
      }
      throw new Error(`unexpected collection: ${name}`);
    },
    runTransaction: async (cb: (tx: any) => Promise<void>) => cb(tx),
  };

  return { updates, roomRef, playerRefs };
}

describe("resetRoomCommand player reset", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockClear();
    acquireRoomLockMock.mockClear();
    releaseRoomLockMock.mockClear();
  });

  test("clears per-player state atomically on reset", async () => {
    const { updates, roomRef, playerRefs } = setupDb({
      room: {
        status: "clue",
        hostId: "host-1",
        creatorId: "host-1",
        resetRequestId: null,
      },
      players: ["p1", "p2"],
    });

    await resetRoomCommand({
      roomId: "room-1",
      token: "token",
      requestId: "req-1",
      recallSpectators: true,
    });

    const playerUpdates = updates.filter((u) => playerRefs.includes(u.ref));
    expect(playerUpdates).toHaveLength(2);
    playerUpdates.forEach((u) => {
      expect(u.data).toMatchObject({
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
      });
    });

    // Room doc should be updated as well (same transaction).
    expect(updates.some((u) => u.ref === roomRef)).toBe(true);
  });

  test("still clears players on idempotent reset", async () => {
    const { updates, roomRef, playerRefs } = setupDb({
      room: {
        status: "waiting",
        hostId: "host-1",
        creatorId: "host-1",
        resetRequestId: "req-1",
      },
      players: ["p1"],
    });

    await resetRoomCommand({
      roomId: "room-1",
      token: "token",
      requestId: "req-1",
      recallSpectators: true,
    });

    const playerUpdates = updates.filter((u) => playerRefs.includes(u.ref));
    expect(playerUpdates).toHaveLength(1);

    // Idempotent path should not rewrite the room payload.
    expect(updates.some((u) => u.ref === roomRef)).toBe(false);
  });
});
