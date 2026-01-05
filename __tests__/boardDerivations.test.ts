import {
  buildPlaceholderSlots,
  computeSlotCountTarget,
  countActiveProposalIds,
  isGameActiveStatus,
} from "@/components/central-board/boardDerivations";

describe("countActiveProposalIds", () => {
  it("counts only non-empty string ids", () => {
    expect(countActiveProposalIds(["alice", null, "", "bob"])).toBe(2);
  });
});

describe("buildPlaceholderSlots", () => {
  it("returns empty array when missingPlayerIds is empty", () => {
    expect(
      buildPlaceholderSlots({
        boardProposal: ["alice", "bob"],
        missingPlayerIds: [],
      })
    ).toEqual([]);
  });

  it("returns placeholder slots for missing players on the board", () => {
    const boardProposal = ["alice", null, "ghost", "bob"];
    const missingPlayerIds = ["ghost"];
    const result = buildPlaceholderSlots({ boardProposal, missingPlayerIds });
    expect(result).toEqual([{ slot: 2, cardId: "ghost" }]);
    expect(boardProposal).toEqual(["alice", null, "ghost", "bob"]);
    expect(missingPlayerIds).toEqual(["ghost"]);
  });
});

describe("isGameActiveStatus", () => {
  it("returns true only for in-game statuses", () => {
    expect(isGameActiveStatus("clue")).toBe(true);
    expect(isGameActiveStatus("reveal")).toBe(true);
    expect(isGameActiveStatus("finished")).toBe(true);
    expect(isGameActiveStatus("waiting")).toBe(false);
    expect(isGameActiveStatus(null)).toBe(false);
    expect(isGameActiveStatus(undefined)).toBe(false);
  });
});

describe("computeSlotCountTarget", () => {
  it("uses the larger of explicit slotCount and eligible count", () => {
    expect(computeSlotCountTarget(5, 3)).toBe(5);
    expect(computeSlotCountTarget(0, 4)).toBe(4);
    expect(computeSlotCountTarget(null, 2)).toBe(2);
  });

  it("clamps invalid or negative counts to 0", () => {
    expect(computeSlotCountTarget(-1, 2)).toBe(2);
    expect(computeSlotCountTarget(0, -3)).toBe(0);
    expect(computeSlotCountTarget(undefined, Number.NaN)).toBe(0);
  });
});
