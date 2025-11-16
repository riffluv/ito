import { createActor } from "xstate";

import { createRoomMachine } from "@/lib/state/roomMachine";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { readMetrics } from "@/lib/utils/metrics";

const baseRoom: RoomDoc = {
  name: "Test Room",
  hostId: "host",
  creatorId: "host",
  options: {
    allowContinueAfterFail: true,
    resolveMode: "sort-submit",
  },
  status: "waiting",
  requiresPassword: false,
  passwordHash: null,
  passwordSalt: null,
  passwordVersion: null,
  topic: null,
  topicOptions: null,
  topicBox: null,
  order: null,
  result: null,
  stats: {
    gameCount: 0,
    successCount: 0,
    failureCount: 0,
    currentStreak: 0,
    bestStreak: 0,
  },
  deal: null,
  round: 0,
  mvpVotes: null,
};

const basePlayer: PlayerDoc & { id: string } = {
  id: "player-1",
  name: "Alice",
  avatar: "knight",
  number: null,
  clue1: "",
  ready: false,
  orderIndex: 0,
  uid: "uid-1",
  lastSeen: undefined,
  joinedAt: undefined,
};

const makePlayer = (overrides?: Partial<PlayerDoc & { id: string }>) => ({
  ...basePlayer,
  ...overrides,
});

const makeRoom = (overrides?: Partial<RoomDoc>): RoomDoc => ({
  ...baseRoom,
  ...overrides,
  options: {
    ...baseRoom.options,
    ...(overrides?.options ?? {}),
  },
});

describe("roomMachine snapshot handling", () => {
  beforeEach(() => {
    (window as typeof window & { __ITO_METRICS__?: Record<string, unknown> }).__ITO_METRICS__ =
      {};
  });

  it("reuses sanitized player references when snapshot data is unchanged", () => {
    const machine = createRoomMachine({
      roomId: "room-1",
      room: makeRoom(),
      players: [makePlayer()],
    });
    const actor = createActor(machine);
    actor.start();
    const initialPlayers = actor.getSnapshot().context.players;

    actor.send({
      type: "SYNC",
      room: makeRoom(),
      players: [makePlayer()],
      presenceReady: true,
    });

    const nextPlayers = actor.getSnapshot().context.players;
    expect(nextPlayers).toBe(initialPlayers);
  });

  it("emits a new players array when a player record changes", () => {
    const machine = createRoomMachine({
      roomId: "room-2",
      room: makeRoom(),
      players: [makePlayer()],
    });
    const actor = createActor(machine);
    actor.start();
    const initialPlayers = actor.getSnapshot().context.players;

    actor.send({
      type: "SYNC",
      room: makeRoom(),
      players: [makePlayer({ ready: true })],
    });

    const updatedPlayers = actor.getSnapshot().context.players;
    expect(updatedPlayers).not.toBe(initialPlayers);
    expect(updatedPlayers[0]?.ready).toBe(true);
  });

  it("records room metrics whenever a snapshot is applied", () => {
    const machine = createRoomMachine({
      roomId: "room-3",
      room: makeRoom(),
      players: [makePlayer()],
    });
    const actor = createActor(machine);
    actor.start();

    actor.send({
      type: "SYNC",
      room: makeRoom({ status: "clue" }),
      players: [makePlayer(), makePlayer({ id: "player-2", name: "Bob" })],
      onlineUids: ["uid-1", "uid-2"],
      presenceReady: true,
    });

    const metrics = readMetrics();
    expect(metrics.room?.players).toBe(2);
    expect(metrics.room?.online).toBe(2);
    expect(metrics.room?.status).toBe("clue");
    expect(metrics.room?.presenceReady).toBe(1);
  });
});
