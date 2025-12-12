import {
  computeSlotCount,
  computeVisibleProposal,
  getPresenceEligibleIds,
} from "@/lib/game/selectors";

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
      playerIds: ["a", "b"],
    });
    expect(n).toBe(1); // max(proposal=1, online=1)
  });

  test("computeSlotCount ignores spectators when presenceReady", () => {
    const n = computeSlotCount({
      status: "clue" as any,
      orderList: [],
      dealPlayers: ["a", "b"],
      proposal: [],
      presenceReady: true,
      onlineUids: ["a", "spectator-1"],
      playersCount: 2,
      playerIds: ["a", "b"],
    });
    expect(n).toBe(2); // max(proposal=0, filtered online=1, players=2)
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

  test("getPresenceEligibleIds blocks by default when not ready and empty", () => {
    const ids = getPresenceEligibleIds({
      baseIds: ["a", "b"],
      onlineUids: undefined,
      presenceReady: false,
    });
    expect(ids).toEqual([]);
  });

  test("getPresenceEligibleIds falls back when blockWhenNotReadyEmpty=false", () => {
    const ids = getPresenceEligibleIds({
      baseIds: ["a", "b"],
      onlineUids: undefined,
      presenceReady: false,
      blockWhenNotReadyEmpty: false,
    });
    expect(ids).toEqual(["a", "b"]);
  });
});
