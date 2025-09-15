import { mergeFinalizeResult, type RoomResult } from "@/lib/game/finalize";

describe("mergeFinalizeResult", () => {
  test("returns current if already set", () => {
    const current: RoomResult = { success: true, failedAt: null, lastNumber: 99 };
    const next: RoomResult = { success: true, failedAt: null, lastNumber: 100 };
    expect(mergeFinalizeResult(current, next)).toBe(current);
  });

  test("uses next if current is null", () => {
    const current: RoomResult = null;
    const next: RoomResult = { success: false, failedAt: 3, lastNumber: 20 };
    expect(mergeFinalizeResult(current, next)).toEqual(next);
  });

  test("null + null stays null", () => {
    expect(mergeFinalizeResult(null, null)).toBeNull();
  });
});

