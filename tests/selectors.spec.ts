import { computeSlotCount, computeVisibleProposal } from "@/lib/game/selectors";

describe("selectors minimal", () => {
  test("computeSlotCount uses online count when presenceReady", () => {
    const n = computeSlotCount({
      status: "clue" as any,
      orderList: [],
      dealPlayers: ["a", "b"],
      proposal: ["a"],
      presenceReady: true,
      onlineUids: ["a"],
      playersCount: 1,
    });
    expect(n).toBe(1); // max(proposal=1, online=1)
  });

  test("computeVisibleProposal filters by eligible in clue", () => {
    const v = computeVisibleProposal({
      status: "clue" as any,
      orderList: ["x"],
      proposal: ["x", "y"],
      eligibleIds: ["x"],
    });
    expect(v).toEqual(["x"]);
  });
});
