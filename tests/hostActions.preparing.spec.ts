import { test, expect } from "@playwright/test";
import { buildHostActionModel } from "../lib/host/hostActionsModel";
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
  ui: {},
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

test.describe("host action model preparing gate", () => {
  test("waiting中で ui.roundPreparing=true のとき quickStart/advanced が disabled", () => {
    const room = baseRoom({
      status: "waiting",
      ui: { roundPreparing: true },
    });
    const intents = buildHostActionModel(
      room,
      [player("p1"), player("p2")],
      2,
      [],
      null
    );
    const quickStart = intents.find((i) => i.key === "quickStart");
    const advanced = intents.find((i) => i.key === "advancedMode");
    expect(quickStart?.disabled).toBe(true);
    expect(quickStart?.reason).toBe("準備中です");
    expect(advanced?.disabled).toBe(true);
    expect(advanced?.reason).toBe("準備中です");
  });

  test("clue中で ui.revealPending=true のとき evaluate/reset が disabled", () => {
    const room = baseRoom({
      status: "clue",
      topic: "topic",
      topicBox: "通常版",
      order: { list: ["p1", "p2"], proposal: [], failed: false, lastNumber: null, total: 2 } as any,
      ui: { revealPending: true },
    });
    const intents = buildHostActionModel(
      room,
      [player("p1"), player("p2")],
      2,
      [],
      null
    );
    const evaluate = intents.find((i) => i.key === "evaluate");
    const reset = intents.find((i) => i.key === "reset");
    expect(evaluate?.disabled).toBe(true);
    expect(evaluate?.reason).toBe("準備中です");
    expect(reset?.disabled).toBe(true);
    expect(reset?.reason).toBe("準備中です");
  });
});

