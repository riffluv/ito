import { computeBoardActiveProposal } from "@/lib/game/selectors";

describe("computeBoardActiveProposal", () => {
  test("waiting always returns empty (prevents stale flicker)", () => {
    const eligibleIdSet = new Set(["p1"]);
    expect(
      computeBoardActiveProposal({
        status: "waiting",
        orderList: ["p1"],
        proposal: ["p1"],
        eligibleIdSet,
        orderListKey: "p1",
        proposalKey: "p1",
      })
    ).toEqual([]);
  });

  test("reveal returns order list as-is (history, no eligible filtering)", () => {
    const eligibleIdSet = new Set<string>();
    expect(
      computeBoardActiveProposal({
        status: "reveal",
        orderList: ["p1", ""],
        proposal: ["p2"],
        eligibleIdSet,
        orderListKey: "p1,",
        proposalKey: "p2",
      })
    ).toEqual(["p1", null]);
  });

  test("finished returns order list as-is (history)", () => {
    const eligibleIdSet = new Set(["p1"]);
    expect(
      computeBoardActiveProposal({
        status: "finished",
        orderList: ["p1", "p2"],
        proposal: ["p1"],
        eligibleIdSet,
        orderListKey: "p1,p2",
        proposalKey: "p1",
      })
    ).toEqual(["p1", "p2"]);
  });

  test("clue returns proposal slots filtered by eligible (keeps indices)", () => {
    const eligibleIdSet = new Set(["p1"]);
    expect(
      computeBoardActiveProposal({
        status: "clue",
        orderList: ["p1", "p2"],
        proposal: ["p1", "p2", null],
        eligibleIdSet,
        orderListKey: "p1,p2",
        proposalKey: "p1,p2,",
      })
    ).toEqual(["p1", null, null]);
  });

  test("clue falls back to order list when proposal has no eligible entries", () => {
    const eligibleIdSet = new Set(["p1", "p2"]);
    expect(
      computeBoardActiveProposal({
        status: "clue",
        orderList: ["p1", "p2"],
        proposal: ["x"],
        eligibleIdSet,
        orderListKey: "p1,p2",
        proposalKey: "x",
      })
    ).toEqual(["p1", "p2"]);
  });

  test("returns empty when both proposal and order are empty", () => {
    const eligibleIdSet = new Set(["p1"]);
    expect(
      computeBoardActiveProposal({
        status: "clue",
        orderList: [],
        proposal: [],
        eligibleIdSet,
        orderListKey: "",
        proposalKey: "",
      })
    ).toEqual([]);
  });
});

