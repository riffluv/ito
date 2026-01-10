import {
  clamp,
  deriveRoundPlayers,
  isActorAllowedToMutateProposal,
  isResolveModeSortSubmit,
  normalizeProposalForRound,
  readProposal,
} from "@/lib/server/roomCommandsProposal/helpers";

describe("roomCommandsProposal helpers", () => {
  test("readProposal coerces non-string/empty to null and keeps non-empty strings", () => {
    expect(readProposal(["a", "", null, undefined, "b"])).toEqual(["a", null, null, null, "b"]);
    expect(readProposal("nope")).toEqual([]);
  });

  test("clamp clamps value to min/max", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  test("isResolveModeSortSubmit allows missing resolveMode and only accepts sort-submit", () => {
    expect(isResolveModeSortSubmit({ options: {} } as any)).toBe(true);
    expect(isResolveModeSortSubmit({ options: { resolveMode: "sort-submit" } } as any)).toBe(true);
    expect(isResolveModeSortSubmit({ options: { resolveMode: "free" } } as any)).toBe(false);
  });

  test("deriveRoundPlayers filters invalid and trims", () => {
    const room = { deal: { players: [" a ", "", "b", "  "] } } as any;
    expect(deriveRoundPlayers(room)).toEqual([" a ", "b"]);
  });

  test("isActorAllowedToMutateProposal allows participant or host/creator", () => {
    const room = { hostId: "h", creatorId: "c" } as any;
    expect(isActorAllowedToMutateProposal({ uid: "p", room, roundPlayers: ["p"] })).toBe(true);
    expect(isActorAllowedToMutateProposal({ uid: "h", room, roundPlayers: [] })).toBe(true);
    expect(isActorAllowedToMutateProposal({ uid: "c", room, roundPlayers: [] })).toBe(true);
    expect(isActorAllowedToMutateProposal({ uid: "x", room, roundPlayers: [] })).toBe(false);
  });

  test("normalizeProposalForRound clears on seed mismatch and filters to round players", () => {
    expect(
      normalizeProposalForRound({
        proposal: ["a", "x", null],
        roundPlayers: ["a", "b"],
        roomSeed: "s1",
        docSeed: "s2",
      })
    ).toEqual([]);

    expect(
      normalizeProposalForRound({
        proposal: ["a", "x", null],
        roundPlayers: ["a", "b"],
        roomSeed: "s1",
        docSeed: "s1",
      })
    ).toEqual(["a", null, null]);
  });
});

