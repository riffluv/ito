import {
  deriveJoinGate,
  deriveWasSeated,
} from "@/lib/server/roomCommandsJoinRoom/helpers";

describe("roomCommandsJoinRoom helpers", () => {
  test("deriveWasSeated checks deal.players/seatHistory/order list/proposal", () => {
    const room = {
      deal: { players: ["u1"], seatHistory: { u2: 0 } },
      order: { list: ["u3"], proposal: ["u4"] },
    } as any;
    expect(deriveWasSeated({ uid: "u1", room })).toBe(true);
    expect(deriveWasSeated({ uid: "u2", room })).toBe(true);
    expect(deriveWasSeated({ uid: "u3", room })).toBe(true);
    expect(deriveWasSeated({ uid: "u4", room })).toBe(true);
    expect(deriveWasSeated({ uid: "uX", room })).toBe(false);
  });

  test("deriveJoinGate blocks in_progress when not host and not seated and status!=waiting", () => {
    const gate = deriveJoinGate({
      uid: "u1",
      hostId: "host",
      status: "clue",
      recallOpen: true,
      wasSeated: false,
    });
    expect(gate).toEqual({
      ok: false,
      errorCode: "in_progress",
      errorMessage: "room_in_progress",
    });
  });

  test("deriveJoinGate blocks recall_closed when waiting + recallOpen false and not seated", () => {
    const gate = deriveJoinGate({
      uid: "u1",
      hostId: "host",
      status: "waiting",
      recallOpen: false,
      wasSeated: false,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.errorCode).toBe("recall_closed");
      expect(gate.errorMessage).toBe("room_recall_closed");
    }
  });

  test("deriveJoinGate allows host always and seated users in non-waiting", () => {
    expect(
      deriveJoinGate({
        uid: "host",
        hostId: "host",
        status: "clue",
        recallOpen: false,
        wasSeated: false,
      })
    ).toEqual({ ok: true });

    expect(
      deriveJoinGate({
        uid: "u1",
        hostId: "host",
        status: "reveal",
        recallOpen: true,
        wasSeated: true,
      })
    ).toEqual({ ok: true });
  });
});
