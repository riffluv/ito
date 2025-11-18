import { buildRevealOutcomePayload, buildPlayOutcomePayload } from "@/lib/game/domain";
import { defaultOrderState } from "@/lib/game/rules";

describe("buildRevealOutcomePayload", () => {
  const numbers = {
    p1: 10,
    p2: 20,
    p3: 30,
  };

  test("returns success payload when sorted ascending", () => {
    const payload = buildRevealOutcomePayload({
      list: ["p1", "p2", "p3"],
      numbers,
      expectedTotal: 3,
      previousStats: {
        gameCount: 5,
        successCount: 4,
        failureCount: 1,
        currentStreak: 2,
        bestStreak: 4,
      },
    });

    expect(payload.success).toBe(true);
    expect(payload.order.failed).toBe(false);
    expect(payload.order.total).toBe(3);
    expect(payload.stats.gameCount).toBe(6);
    expect(payload.stats.successCount).toBe(5);
    expect(payload.stats.currentStreak).toBe(3);
    expect(payload.stats.bestStreak).toBe(4);
  });

  test("marks failure and records failedAt", () => {
    const payload = buildRevealOutcomePayload({
      list: ["p2", "p1", "p3"],
      numbers,
      expectedTotal: 3,
      previousStats: null,
    });

    expect(payload.success).toBe(false);
    expect(payload.order.failed).toBe(true);
    expect(payload.order.failedAt).toBe(2);
    expect(payload.stats.failureCount).toBe(1);
    expect(payload.stats.currentStreak).toBe(0);
  });
});

describe("buildPlayOutcomePayload", () => {
  test("continues when not finished", () => {
    const result = buildPlayOutcomePayload({
      currentOrder: defaultOrderState(),
      playerId: "p1",
      myNum: 10,
      total: 3,
      presenceCount: null,
      allowContinue: true,
      previousStats: undefined,
    });
    expect(result.shouldFinish).toBe(false);
    expect(result.next.list).toEqual(["p1"]);
  });

  test("finishes and supplies stats on failure when continue not allowed", () => {
    const result = buildPlayOutcomePayload({
      currentOrder: {
        list: ["p1"],
        lastNumber: 10,
        failed: false,
        failedAt: null,
      },
      playerId: "p2",
      myNum: 5, // descending triggers fail
      total: 3,
      presenceCount: null,
      allowContinue: false,
      previousStats: {
        gameCount: 0,
        successCount: 0,
        failureCount: 0,
        currentStreak: 0,
        bestStreak: 0,
      },
    });
    expect(result.shouldFinish).toBe(true);
    expect(result.payload?.success).toBe(false);
    expect(result.payload?.order.failed).toBe(true);
    expect(result.payload?.stats.failureCount).toBe(1);
  });
});
