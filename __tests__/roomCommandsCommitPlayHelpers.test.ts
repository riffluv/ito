import {
  buildCurrentOrderState,
  deriveAllowContinue,
  deriveRoundPlayers,
  deriveRoundTotal,
  isPlayerMismatch,
} from "@/lib/server/roomCommandsCommitPlay/helpers";

describe("roomCommandsCommitPlay helpers", () => {
  test("isPlayerMismatch matches uid vs playerId", () => {
    expect(isPlayerMismatch({ uid: "u1", playerId: "u1" })).toBe(false);
    expect(isPlayerMismatch({ uid: "u1", playerId: "u2" })).toBe(true);
  });

  test("deriveAllowContinue uses room.options.allowContinueAfterFail", () => {
    expect(deriveAllowContinue({ options: { allowContinueAfterFail: true } } as any)).toBe(true);
    expect(deriveAllowContinue({ options: { allowContinueAfterFail: false } } as any)).toBe(false);
    expect(deriveAllowContinue({ options: {} } as any)).toBe(false);
  });

  test("deriveRoundPlayers/deriveRoundTotal read deal.players length", () => {
    const players = ["a", "b"];
    const roundPlayers = deriveRoundPlayers({ deal: { players } } as any);
    expect(roundPlayers).toEqual(players);
    expect(deriveRoundTotal(roundPlayers)).toBe(2);
  });

  test("buildCurrentOrderState mirrors selection rules", () => {
    const room = {
      order: {
        list: ["p1"],
        lastNumber: 9,
        failed: true,
        failedAt: 123,
        total: 10,
      },
    } as any;
    const order = buildCurrentOrderState({
      room,
      decidedAtMs: 0,
      nowMs: 999,
      roundTotal: null,
    });
    expect(order.list).toEqual(["p1"]);
    expect(order.lastNumber).toBe(9);
    expect(order.failed).toBe(true);
    expect(order.failedAt).toBe(123);
    expect(order.decidedAt).toBe(999); // decidedAtMs<=0 => nowMs
    expect(order.total).toBe(10); // falls back to room.order.total
  });
});

