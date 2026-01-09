import {
  applyOutcomeToRoomStats,
  createInitialRoomStats,
  normalizeRoomStats,
} from "@/lib/game/roomStats";

describe("roomStats", () => {
  test("createInitialRoomStats returns zeroed stats", () => {
    expect(createInitialRoomStats()).toEqual({
      gameCount: 0,
      successCount: 0,
      failureCount: 0,
      currentStreak: 0,
      bestStreak: 0,
    });
  });

  test("normalizeRoomStats clamps invalid values and ensures bestStreak >= currentStreak", () => {
    expect(
      normalizeRoomStats({
        gameCount: -1,
        successCount: 2.8,
        failureCount: Number.NaN,
        currentStreak: 3,
        bestStreak: 1,
      })
    ).toEqual({
      gameCount: 0,
      successCount: 2,
      failureCount: 0,
      currentStreak: 3,
      bestStreak: 3,
    });
  });

  test("applyOutcomeToRoomStats increments counts and updates streaks", () => {
    const start = createInitialRoomStats();
    const afterSuccess = applyOutcomeToRoomStats(start, "success");
    expect(afterSuccess).toEqual({
      gameCount: 1,
      successCount: 1,
      failureCount: 0,
      currentStreak: 1,
      bestStreak: 1,
    });

    const afterSecondSuccess = applyOutcomeToRoomStats(afterSuccess, "success");
    expect(afterSecondSuccess.currentStreak).toBe(2);
    expect(afterSecondSuccess.bestStreak).toBe(2);
    expect(afterSecondSuccess.gameCount).toBe(2);

    const afterFailure = applyOutcomeToRoomStats(afterSecondSuccess, "failure");
    expect(afterFailure.currentStreak).toBe(0);
    expect(afterFailure.bestStreak).toBe(2);
    expect(afterFailure.failureCount).toBe(1);
  });
});

