import { expect, test } from "@playwright/test";
import { createActor } from "xstate";
import { createRoomMachine } from "../lib/state/roomMachine";
import type { PlayerDoc, RoomDoc } from "../lib/types";

const baseRoom = (overrides: Partial<RoomDoc> = {}): RoomDoc => ({
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
  deal: null,
  round: 0,
  mvpVotes: null,
  ...overrides,
});

const player = (
  id: string,
  overrides: Partial<PlayerDoc> = {}
): PlayerDoc & { id: string } => ({
  id,
  name: `Player ${id}`,
  avatar: "",
  clue1: "",
  number: null,
  ready: false,
  orderIndex: 0,
  uid: id,
  ...overrides,
});

const startMachine = (
  input: {
    room: RoomDoc;
    players: Array<PlayerDoc & { id: string }>;
    onlineUids?: string[];
    presenceReady?: boolean;
    deps?: Partial<Parameters<typeof createRoomMachine>[0]["deps"]>;
  },
  roomId = "room-1"
) => {
  const machine = createRoomMachine({
    roomId,
    room: input.room,
    players: input.players,
    onlineUids: input.onlineUids,
    presenceReady: input.presenceReady,
    deps: input.deps,
  });
  const actor = createActor(machine);
  actor.start();
  actor.send({
    type: "SYNC",
    room: input.room,
    players: input.players,
    onlineUids: input.onlineUids,
    presenceReady: input.presenceReady,
  });
  return actor;
};

const expectPhase = (actor: ReturnType<typeof startMachine>, expected: RoomDoc["status"]) => {
  const snapshotValue = actor.getSnapshot().value;
  if (typeof snapshotValue === "string") {
    expect(snapshotValue).toBe(expected);
    return;
  }
  if (snapshotValue && typeof snapshotValue === "object" && "phase" in snapshotValue) {
    expect((snapshotValue as { phase?: string }).phase).toBe(expected);
    return;
  }
  throw new Error(`Unexpected state value: ${JSON.stringify(snapshotValue)}`);
};

test("START で waiting から clue へ遷移し、startGame が呼ばれる", async () => {
  const calls: string[] = [];
  const room = baseRoom({
    status: "waiting",
    deal: { seed: "seed", min: 1, max: 100, players: [] },
  });
  const players = [
    player("p1", { ready: true }),
    player("p2", { ready: true }),
  ];
  const actor = startMachine(
    {
      room,
      players,
      onlineUids: ["p1", "p2"],
      presenceReady: true,
      deps: {
        startGame: async (roomId: string) => {
          calls.push(roomId);
        },
      },
    },
    "room-start"
  );

  actor.send({ type: "START" });

  expectPhase(actor, "clue");
  expect(calls).toEqual(["room-start"]);
  actor.stop();
});

test("プレイヤー不足では START を拒否する", async () => {
  const calls: string[] = [];
  const room = baseRoom({
    status: "waiting",
    deal: { seed: "seed", min: 1, max: 100, players: [] },
  });
  const players: Array<PlayerDoc & { id: string }> = [];
  const actor = startMachine(
    {
      room,
      players,
      onlineUids: ["p1"],
      presenceReady: false,
      deps: {
        startGame: async (roomId: string) => {
          calls.push(roomId);
        },
      },
    },
    "room-deny"
  );

  actor.send({ type: "START" });

  expectPhase(actor, "waiting");
  expect(calls).toEqual([]);
  actor.stop();
});

test("SUBMIT_ORDER で clue から reveal へ遷移し、submitSortedOrder が呼ばれる", async () => {
  const calls: Array<{ roomId: string; list: string[] }> = [];
  const room = baseRoom({
    status: "clue",
    deal: { seed: "seed", min: 1, max: 100, players: ["p1", "p2"] },
  });
  const players = [
    player("p1", { ready: true }),
    player("p2", { ready: true }),
  ];
  const actor = startMachine(
    {
      room,
      players,
      onlineUids: ["p1", "p2"],
      presenceReady: true,
      deps: {
        submitSortedOrder: async (roomId: string, list: string[]) => {
          calls.push({ roomId, list });
        },
      },
    },
    "room-submit"
  );

  actor.send({ type: "SUBMIT_ORDER", list: ["p1", "p2"] });

  expectPhase(actor, "reveal");
  expect(calls).toEqual([{ roomId: "room-submit", list: ["p1", "p2"] }]);
  actor.stop();
});

test("無効な並びでは SUBMIT_ORDER を無視する", async () => {
  const calls: Array<string[]> = [];
  const room = baseRoom({
    status: "clue",
    deal: { seed: "seed", min: 1, max: 100, players: ["p1", "p2"] },
  });
  const players = [
    player("p1", { ready: true }),
    player("p2", { ready: false }),
  ];
  const actor = startMachine(
    {
      room,
      players,
      onlineUids: ["p1", "p2"],
      presenceReady: true,
      deps: {
        submitSortedOrder: async (_roomId: string, list: string[]) => {
          calls.push(list);
        },
      },
    },
    "room-invalid"
  );

  actor.send({ type: "SUBMIT_ORDER", list: ["p1", "p2"] });

  expectPhase(actor, "clue");
  expect(calls).toEqual([]);
  actor.stop();
});

test("REVEAL_DONE で finished へ遷移し finalizeReveal が呼ばれる", async () => {
  const calls: string[] = [];
  const room = baseRoom({ status: "reveal" });
  const players = [
    player("p1", { ready: true }),
    player("p2", { ready: true }),
  ];
  const actor = startMachine(
    {
      room,
      players,
      onlineUids: ["p1", "p2"],
      presenceReady: true,
      deps: {
        finalizeReveal: async (roomId: string) => {
          calls.push(roomId);
        },
      },
    },
    "room-finalize"
  );

  actor.send({ type: "REVEAL_DONE" });

  expectPhase(actor, "finished");
  expect(calls).toEqual(["room-finalize"]);
  actor.stop();
});

test("RESET は任意状態から waiting へ戻し resetRoomWithPrune を呼ぶ", async () => {
  const calls: Array<{ roomId: string; keepIds: any; options: any }> = [];
  const room = baseRoom({ status: "finished" });
  const players = [
    player("p1", { ready: true }),
    player("p2", { ready: true }),
  ];
  const actor = startMachine(
    {
      room,
      players,
      onlineUids: ["p1", "p2"],
      presenceReady: true,
      deps: {
        resetRoomWithPrune: async (roomId: string, keepIds, options) => {
          calls.push({ roomId, keepIds, options });
        },
      },
    },
    "room-reset"
  );

  actor.send({ type: "RESET", keepIds: ["keep-1"], options: { notifyChat: true } });

  expectPhase(actor, "waiting");
  expect(calls).toEqual([
    {
      roomId: "room-reset",
      keepIds: ["keep-1"],
      options: { notifyChat: true, requestId: expect.any(String) },
    },
  ]);
  actor.stop();
});

test("SYNC は RoomDoc の status に追従する", async () => {
  const room = baseRoom({ status: "waiting" });
  const players = [
    player("p1", { ready: true }),
    player("p2", { ready: true }),
  ];
  const actor = startMachine(
    {
      room,
      players,
      onlineUids: ["p1", "p2"],
      presenceReady: true,
    },
    "room-sync"
  );

  actor.send({
    type: "SYNC",
    room: baseRoom({ status: "reveal" }),
    players,
    onlineUids: ["p1", "p2"],
    presenceReady: true,
  });

  expectPhase(actor, "reveal");
  actor.stop();
});
