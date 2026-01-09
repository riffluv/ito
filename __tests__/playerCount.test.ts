import { logWarn } from "@/lib/utils/log";

jest.mock("@/lib/utils/log", () => ({
  logWarn: jest.fn(),
}));

import { calculateEffectiveActive } from "@/lib/utils/playerCount";

describe("calculateEffectiveActive", () => {
  beforeEach(() => {
    (logWarn as unknown as jest.Mock).mockClear();
  });

  it("falls back to playersCount when onlineCount is not a finite non-negative number", () => {
    expect(calculateEffectiveActive(undefined, 3)).toBe(3);
    expect(calculateEffectiveActive(Number.NaN, 3)).toBe(3);
    expect(calculateEffectiveActive(-1, 3)).toBe(3);
  });

  it("normalizes playersCount to a non-negative integer", () => {
    expect(calculateEffectiveActive(undefined, -5)).toBe(0);
    expect(calculateEffectiveActive(undefined, 3.9)).toBe(3);
    expect(calculateEffectiveActive(undefined, Number.NaN as unknown as number)).toBe(0);
  });

  it("returns normalized onlineCount when drift is within maxDrift", () => {
    expect(calculateEffectiveActive(4.9, 3)).toBe(4);
    expect(calculateEffectiveActive(5, 4, { maxDrift: 2 })).toBe(5);
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("when drift exceeds maxDrift, returns max(onlineCount, playersCount) and logs a warning", () => {
    expect(calculateEffectiveActive(10, 3, { maxDrift: 2 })).toBe(10);
    expect(logWarn).toHaveBeenCalledTimes(1);

    (logWarn as unknown as jest.Mock).mockClear();
    expect(calculateEffectiveActive(1, 10, { maxDrift: 2 })).toBe(10);
    expect(logWarn).toHaveBeenCalledTimes(1);
  });
});

