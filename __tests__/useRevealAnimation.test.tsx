import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";

const finalizeRevealMock = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/game/room", () => ({
  finalizeReveal: (...args: unknown[]) => finalizeRevealMock(...args),
}));

const touchSortedRevealCache = jest.fn();
const readSortedRevealCache = jest.fn();
const clearSortedRevealCache = jest.fn();

jest.mock("@/lib/game/resultPrefetch", () => ({
  touchSortedRevealCache: (...args: unknown[]) =>
    touchSortedRevealCache(...args),
  readSortedRevealCache: (...args: unknown[]) => readSortedRevealCache(...args),
  clearSortedRevealCache: (...args: unknown[]) =>
    clearSortedRevealCache(...args),
}));

jest.mock("@/components/ui/ThreeBackground", () => ({}));
jest.mock("@/lib/pixi/victoryRays", () => ({}));
jest.mock("@/lib/audio/global", () => ({
  getGlobalSoundManager: () => ({
    prewarm: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock("@/lib/ui/motion", () => ({
  REVEAL_FIRST_DELAY: 10,
  REVEAL_INITIAL_STEP_DELAY: 10,
  REVEAL_MIN_STEP_DELAY: 10,
  REVEAL_ACCELERATION_FACTOR: 1, // テスト用に加速なし
  FLIP_DURATION_MS: 5,
  RESULT_INTRO_DELAY: 5,
  RESULT_RECOGNITION_DELAY: 0,
  FINAL_TWO_BONUS_DELAY: 0,
  FLIP_EVALUATION_DELAY: 5,
}));

jest.mock("@/lib/firebase/require", () => ({
  requireDb: jest.fn(() => ({})),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((...args: unknown[]) => ({ args })),
  runTransaction: jest.fn(async (_db: unknown, updater: any) => {
    const snap = {
      exists: () => true,
      data: () => ({}),
    };
    await updater({
      get: async () => snap,
      update: jest.fn(),
    });
  }),
  serverTimestamp: jest.fn(() => 0),
}));

jest.mock("@/lib/utils/log", () => ({
  logWarn: jest.fn(),
}));

describe("useRevealAnimation", () => {
  it("reveals all cards and schedules finalize for 3+ players", async () => {
    finalizeRevealMock.mockClear();
    const orderList = ["a", "b", "c"];
    const orderNumbers = { a: 1, b: 2, c: 3 };
    const updates: Array<ReturnType<typeof useRevealAnimation>> = [];

    function Harness() {
      const state = useRevealAnimation({
        roomId: "room-1",
        roomStatus: "reveal",
        resolveMode: "sort-submit",
        orderListLength: orderList.length,
        orderData: { list: orderList, numbers: orderNumbers },
      });

      useEffect(() => {
        updates.push(state);
      }, [state]);

      return null;
    }

    render(<Harness />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });

    await waitFor(() => {
      const last = updates[updates.length - 1];
      expect(last?.revealIndex).toBe(orderList.length);
      expect(last?.finalizeScheduled).toBe(true);
    });
    await waitFor(() => {
      expect(finalizeRevealMock).toHaveBeenCalledTimes(1);
    });
  });
});
