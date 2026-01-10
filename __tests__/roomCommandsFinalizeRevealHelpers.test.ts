import {
  canFinalizeReveal,
  deriveRoundPlayersForFinalize,
} from "@/lib/server/roomCommandsFinalizeReveal/helpers";

describe("roomCommandsFinalizeReveal helpers", () => {
  test("deriveRoundPlayersForFinalize trims and filters", () => {
    expect(
      deriveRoundPlayersForFinalize({ deal: { players: [" a ", null, "b", " "] } } as any)
    ).toEqual(["a", "b"]);
  });

  test("canFinalizeReveal allows host/creator or participant", () => {
    const room = { hostId: "h", creatorId: "c" } as any;
    const roundPlayers = ["p"];
    expect(canFinalizeReveal({ uid: "h", room, roundPlayers })).toBe(true);
    expect(canFinalizeReveal({ uid: "c", room, roundPlayers })).toBe(true);
    expect(canFinalizeReveal({ uid: "p", room, roundPlayers })).toBe(true);
    expect(canFinalizeReveal({ uid: "x", room, roundPlayers })).toBe(false);
  });
});

