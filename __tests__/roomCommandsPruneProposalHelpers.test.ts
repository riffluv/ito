import {
  buildEligibleIdSet,
  filterProposalByEligible,
} from "@/lib/server/roomCommandsPruneProposal/helpers";

describe("roomCommandsPruneProposal helpers", () => {
  test("buildEligibleIdSet trims, dedupes, and ignores empty/non-string", () => {
    const set = buildEligibleIdSet([" a ", "", "b", null, "a"]);
    expect(Array.from(set).sort()).toEqual(["a", "b"]);
  });

  test("filterProposalByEligible filters and keeps only eligible strings", () => {
    const eligible = new Set(["a", "c"]);
    expect(filterProposalByEligible(["a", null, "b", "c"], eligible)).toEqual(["a", "c"]);
    expect(filterProposalByEligible("nope", eligible)).toEqual([]);
  });
});

