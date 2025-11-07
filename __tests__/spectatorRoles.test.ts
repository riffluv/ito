import { deriveSpectatorFlags } from "@/lib/room/spectatorRoles";

const baseInput = {
  hasUid: true,
  isHost: false,
  isMember: false,
  hasOptimisticSeat: false,
  seatAcceptanceActive: false,
  seatRequestPending: false,
  joinStatus: "idle" as const,
  loading: false,
};

describe("deriveSpectatorFlags", () => {
  it("treats pending seat requests as spectator candidates", () => {
    const result = deriveSpectatorFlags({
      ...baseInput,
      seatRequestPending: true,
    });
    expect(result.spectatorCandidate).toBe(true);
  });

  it("keeps spectator candidate true after reload with accepted seat", () => {
    const result = deriveSpectatorFlags({
      ...baseInput,
      seatAcceptanceActive: true,
    });
    expect(result.spectatorCandidate).toBe(true);
  });

  it("suppresses spectator mode while joining or retrying", () => {
    const result = deriveSpectatorFlags({
      ...baseInput,
      joinStatus: "joining",
    });
    expect(result.spectatorCandidate).toBe(false);
    expect(result.isJoiningOrRetrying).toBe(true);
  });
});
