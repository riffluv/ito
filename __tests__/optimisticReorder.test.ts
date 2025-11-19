import { buildOptimisticProposalSnapshot } from "@/components/central-board/optimisticReorder";

describe("buildOptimisticProposalSnapshot", () => {
  it("swaps cards when moving onto an occupied slot", () => {
    const base = ["alice", "bob"];
    const result = buildOptimisticProposalSnapshot(base, "alice", 1);
    expect(result).toEqual(["bob", "alice"]);
  });

  it("moves cards into empty slots without leaving trailing nulls", () => {
    const base = ["alice", "bob"];
    const result = buildOptimisticProposalSnapshot(base, "bob", 3);
    expect(result).toEqual(["alice", null, null, "bob"]);
  });

  it("returns null when the player is already at the target index", () => {
    const base = ["alice", "bob"];
    const result = buildOptimisticProposalSnapshot(base, "bob", 1);
    expect(result).toBeNull();
  });
});
