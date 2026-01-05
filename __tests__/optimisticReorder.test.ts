import {
  buildOptimisticProposalSnapshot,
  buildOptimisticStateKey,
  buildProposalSignature,
  buildRenderedProposalForSignature,
  sanitizeOptimisticProposal,
} from "@/components/central-board/optimisticReorder";

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

describe("buildRenderedProposalForSignature", () => {
  it("places pending ids at their indices and prunes trailing nulls", () => {
    const active = ["alice", "bob"];
    const pending = [null, null, null, "bob"];
    const result = buildRenderedProposalForSignature({
      activeProposal: active,
      optimisticProposal: null,
      pending,
      optimisticReturningIds: [],
    });
    expect(result).toEqual(["alice", null, null, "bob"]);
    expect(active).toEqual(["alice", "bob"]);
    expect(pending).toEqual([null, null, null, "bob"]);
  });

  it("removes optimistic returning ids from the signature proposal", () => {
    const active = ["alice", "bob", null, "carol"];
    const result = buildRenderedProposalForSignature({
      activeProposal: active,
      optimisticProposal: null,
      pending: [],
      optimisticReturningIds: ["bob"],
    });
    expect(result).toEqual(["alice", null, null, "carol"]);
  });

  it("prefers optimisticProposal over activeProposal", () => {
    const active = ["alice", "bob"];
    const optimistic = ["bob", "alice"];
    const result = buildRenderedProposalForSignature({
      activeProposal: active,
      optimisticProposal: optimistic,
      pending: [],
      optimisticReturningIds: [],
    });
    expect(result).toEqual(["bob", "alice"]);
    expect(active).toEqual(["alice", "bob"]);
    expect(optimistic).toEqual(["bob", "alice"]);
  });

  it("prunes trailing nulls when nothing is pending", () => {
    const result = buildRenderedProposalForSignature({
      activeProposal: ["alice", null],
      optimisticProposal: null,
      pending: [],
      optimisticReturningIds: [],
    });
    expect(result).toEqual(["alice"]);
  });
});

describe("buildProposalSignature", () => {
  it("returns an empty string for empty arrays", () => {
    expect(buildProposalSignature([])).toBe("");
  });

  it("replaces empty slots with underscores", () => {
    expect(buildProposalSignature(["alice", null, "bob"])).toBe("alice|_|bob");
  });
});

describe("buildOptimisticStateKey", () => {
  it("includes optimistic/pending/returning sections", () => {
    expect(
      buildOptimisticStateKey({
        optimisticProposal: ["bob"],
        pending: [null, "alice"],
        optimisticReturningIds: ["carol"],
      })
    ).toBe("bob#_|alice#carol");
  });

  it("omits pending signature when pending has no content", () => {
    expect(
      buildOptimisticStateKey({
        optimisticProposal: null,
        pending: [null, null],
        optimisticReturningIds: [],
      })
    ).toBe("##");
  });
});

describe("sanitizeOptimisticProposal", () => {
  it("removes ids that are not present on the server and prunes trailing nulls", () => {
    expect(
      sanitizeOptimisticProposal({
        optimisticProposal: ["alice", "ghost", null],
        serverProposal: ["alice", "bob"],
      })
    ).toEqual(["alice"]);
  });

  it("returns null when everything is removed", () => {
    expect(
      sanitizeOptimisticProposal({
        optimisticProposal: ["ghost"],
        serverProposal: ["alice"],
      })
    ).toBeNull();
  });
});
