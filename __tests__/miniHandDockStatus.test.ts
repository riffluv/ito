import { deriveEffectiveRoomStatus } from "@/components/ui/mini-hand-dock/miniHandDockStatus";

describe("deriveEffectiveRoomStatus", () => {
  it("keeps the original status when not resetting", () => {
    const result = deriveEffectiveRoomStatus({
      roomStatus: "clue",
      resetUiPending: false,
      isResetting: false,
    });

    expect(result.optimisticResetting).toBe(false);
    expect(result.effectiveRoomStatus).toBe("clue");
  });

  it("forces waiting while resetting, unless already waiting", () => {
    const result = deriveEffectiveRoomStatus({
      roomStatus: "clue",
      resetUiPending: true,
      isResetting: false,
    });

    expect(result.optimisticResetting).toBe(true);
    expect(result.effectiveRoomStatus).toBe("waiting");

    const alreadyWaiting = deriveEffectiveRoomStatus({
      roomStatus: "waiting",
      resetUiPending: true,
      isResetting: true,
    });

    expect(alreadyWaiting.optimisticResetting).toBe(false);
    expect(alreadyWaiting.effectiveRoomStatus).toBe("waiting");
  });
});

