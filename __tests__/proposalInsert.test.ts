import { prepareProposalInsert } from "@/lib/game/domain";

describe("prepareProposalInsert", () => {
  test("inserts into first empty slot when targetIndex is -1", () => {
    const result = prepareProposalInsert(["a", null, "c"], "b", 4, -1);
    expect(result.status).toBe("ok");
    expect(result.normalized).toEqual(["a", "b", "c"]);
    expect(result.finalIndex).toBe(1);
  });

  test("extends array and clamps to maxCount", () => {
    const result = prepareProposalInsert(["a"], "b", 2, -1);
    expect(result.normalized).toEqual(["a", "b"]);
  });

  test("respects occupied target and returns noop", () => {
    const result = prepareProposalInsert(["a", "x"], "b", 3, 1);
    expect(result.status).toBe("noop");
    expect(result.normalized).toEqual(["a", "x"]);
  });

  test("avoids duplicate insertions", () => {
    const result = prepareProposalInsert(["p1", null], "p1", 3, -1);
    expect(result.status).toBe("noop");
    expect(result.finalIndex).toBe(0);
  });

  test("clamps targetIndex within bounds and fills gaps", () => {
    const result = prepareProposalInsert(["a"], "b", 4, 3);
    expect(result.status).toBe("ok");
    expect(result.normalized).toEqual(["a", null, null, "b"]);
    expect(result.finalIndex).toBe(3);
  });
});
