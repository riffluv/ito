import {
  AUTO_RECALL_MAX_ATTEMPTS,
  AUTO_RECALL_RETRY_MS,
  SEAT_REQUEST_TIMEOUT_MS,
  computeSeatRequestTimeoutRemainingMs,
  deriveIsSpectatorMode,
  shouldNotifySeatRequestReset,
} from "@/lib/spectator/v2/useRoomSpectatorFlow/helpers";

describe("useRoomSpectatorFlow helpers", () => {
  test("deriveIsSpectatorMode returns true only for non-member/non-host and non-idle node", () => {
    expect(
      deriveIsSpectatorMode({ isMember: true, isHost: false, spectatorNode: "watching" as any })
    ).toBe(false);
    expect(
      deriveIsSpectatorMode({ isMember: false, isHost: true, spectatorNode: "watching" as any })
    ).toBe(false);
    expect(
      deriveIsSpectatorMode({ isMember: false, isHost: false, spectatorNode: "idle" as any })
    ).toBe(false);
    expect(
      deriveIsSpectatorMode({ isMember: false, isHost: false, spectatorNode: "watching" as any })
    ).toBe(true);
  });

  test("computeSeatRequestTimeoutRemainingMs uses default timeout and clamps at 0", () => {
    expect(
      computeSeatRequestTimeoutRemainingMs({
        requestedAt: 1000,
        now: 1000 + SEAT_REQUEST_TIMEOUT_MS - 1,
      })
    ).toBe(1);
    expect(
      computeSeatRequestTimeoutRemainingMs({
        requestedAt: 1000,
        now: 1000 + SEAT_REQUEST_TIMEOUT_MS + 500,
      })
    ).toBe(0);
  });

  test("computeSeatRequestTimeoutRemainingMs supports custom timeout", () => {
    expect(
      computeSeatRequestTimeoutRemainingMs({
        requestedAt: 100,
        now: 150,
        timeoutMs: 200,
      })
    ).toBe(150);
  });

  test("shouldNotifySeatRequestReset matches current rule", () => {
    expect(
      shouldNotifySeatRequestReset({
        previousStatus: "pending",
        currentStatus: "idle",
        isSpectatorMode: true,
        roomStatus: "waiting" as any,
      })
    ).toBe(true);

    expect(
      shouldNotifySeatRequestReset({
        previousStatus: "pending",
        currentStatus: "idle",
        isSpectatorMode: false,
        roomStatus: "waiting" as any,
      })
    ).toBe(false);

    expect(
      shouldNotifySeatRequestReset({
        previousStatus: "accepted",
        currentStatus: "idle",
        isSpectatorMode: true,
        roomStatus: "waiting" as any,
      })
    ).toBe(false);

    expect(
      shouldNotifySeatRequestReset({
        previousStatus: "pending",
        currentStatus: "idle",
        isSpectatorMode: true,
        roomStatus: "playing" as any,
      })
    ).toBe(false);
  });

  test("constants keep intended values", () => {
    expect(AUTO_RECALL_MAX_ATTEMPTS).toBe(3);
    expect(AUTO_RECALL_RETRY_MS).toBe(3000);
    expect(SEAT_REQUEST_TIMEOUT_MS).toBe(15000);
  });
});

