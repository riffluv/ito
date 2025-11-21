import { expect, test } from "@playwright/test";
import { computeSpectatorGate } from "../lib/hooks/useSpectatorGate";

test.describe("spectator gate", () => {
  test("mid-game direct entry forces spectator mode and mid-game reason", () => {
    const result = computeSpectatorGate({
      roomStatus: "clue",
      isHost: false,
      isMember: false,
      hasOptimisticSeat: false,
      seatAcceptanceActive: false,
      seatRequestPending: false,
      joinStatus: "idle",
      loading: false,
      forcedExitReason: null,
      recallOpen: false,
      versionMismatchBlocksAccess: false,
      hasServerAssignedSeat: false,
      spectatorNode: "idle",
    });

    expect(result.mustSpectateMidGame).toBe(true);
    expect(result.spectatorEnterReason).toBe("mid-game");
    expect(result.spectatorCandidate).toBe(true);
  });

  test("waiting room uses recallOpen to decide reason and allows spectator candidate", () => {
    const result = computeSpectatorGate({
      roomStatus: "waiting",
      isHost: false,
      isMember: false,
      hasOptimisticSeat: false,
      seatAcceptanceActive: false,
      seatRequestPending: false,
      joinStatus: "idle",
      loading: false,
      forcedExitReason: null,
      recallOpen: true,
      versionMismatchBlocksAccess: false,
      hasServerAssignedSeat: false,
      spectatorNode: "idle",
    });

    expect(result.mustSpectateMidGame).toBe(false);
    expect(result.spectatorEnterReason).toBe("waiting-open");
    expect(result.spectatorCandidate).toBe(true);
  });

  test("version mismatch blocks and reports version-mismatch reason", () => {
    const result = computeSpectatorGate({
      roomStatus: "waiting",
      isHost: false,
      isMember: false,
      hasOptimisticSeat: false,
      seatAcceptanceActive: false,
      seatRequestPending: false,
      joinStatus: "joined",
      loading: true,
      forcedExitReason: "version-mismatch",
      recallOpen: true,
      versionMismatchBlocksAccess: true,
      hasServerAssignedSeat: false,
      spectatorNode: "idle",
    });

    expect(result.spectatorEnterReason).toBe("version-mismatch");
    expect(result.loadingForSpectator).toBe(true);
  });
});
