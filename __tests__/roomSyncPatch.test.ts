import { applyRoomSyncPatch } from "@/lib/sync/applyRoomSyncPatch";
import type { RoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import type { RoomDoc } from "@/lib/types";

const baseRoom = (): RoomDoc & { id: string } => ({
  id: "room-1",
  name: "Room",
  hostId: "host-1",
  creatorId: "host-1",
  options: { allowContinueAfterFail: false, resolveMode: "sort-submit" },
  status: "waiting",
  stats: {
    gameCount: 0,
    successCount: 0,
    failureCount: 0,
    currentStreak: 0,
    bestStreak: 0,
  },
  ui: { roundPreparing: true, recallOpen: true, revealPending: false },
  statusVersion: 10,
});

describe("applyRoomSyncPatch", () => {
  test("ignores stale patches", () => {
    const current = baseRoom();
    const patch: RoomSyncPatch = {
      roomId: "room-1",
      statusVersion: 9,
      room: { status: "clue" },
      meta: { source: "api", ts: 123 },
    };

    const result = applyRoomSyncPatch(current, patch);
    expect(result).toEqual({ applied: false, reason: "stale", next: current });
  });

  test("ignores duplicate patches (same version)", () => {
    const current = baseRoom();
    const patch: RoomSyncPatch = {
      roomId: "room-1",
      statusVersion: 10,
      room: { status: "clue" },
      meta: { source: "api", ts: 123 },
    };

    const result = applyRoomSyncPatch(current, patch);
    expect(result).toEqual({ applied: false, reason: "duplicate", next: current });
  });

  test("applies newer patches and merges ui shallowly", () => {
    const current = baseRoom();
    const patch: RoomSyncPatch = {
      roomId: "room-1",
      statusVersion: 11,
      room: { status: "clue", topic: "お題", ui: { roundPreparing: false } },
      meta: { source: "api", ts: 123 },
    };

    const result = applyRoomSyncPatch(current, patch);
    expect(result.applied).toBe(true);
    if (!result.applied) return;
    expect(result.next.status).toBe("clue");
    expect(result.next.topic).toBe("お題");
    expect(result.next.statusVersion).toBe(11);
    expect(result.next.ui).toMatchObject({
      roundPreparing: false,
      recallOpen: true,
      revealPending: false,
    });
    // ensure immutable
    expect(current.status).toBe("waiting");
    expect(current.statusVersion).toBe(10);
  });

  test("ignores patches for other rooms", () => {
    const current = baseRoom();
    const patch: RoomSyncPatch = {
      roomId: "room-2",
      statusVersion: 11,
      room: { status: "clue" },
      meta: { source: "api", ts: 123 },
    };

    const result = applyRoomSyncPatch(current, patch);
    expect(result).toEqual({ applied: false, reason: "room-mismatch", next: current });
  });
});

