import { HostManager, selectHostCandidate } from "@/lib/host/HostManager";

describe("HostManager", () => {
  const basePlayers = [
    { id: "host-1", joinedAt: 10, orderIndex: 0, isOnline: true, name: "Host" },
    { id: "guest-1", joinedAt: 20, orderIndex: 1, isOnline: true, name: "Guest A" },
    { id: "guest-2", joinedAt: 30, orderIndex: 2, isOnline: false, name: "Guest B" },
  ];

  const mapPlayers = (overrides: Partial<typeof basePlayers[number]>[] = []) => {
    return basePlayers.map((p, index) => ({
      ...p,
      ...(overrides[index] ?? {}),
    }));
  };

  test("selectHostCandidate keeps earlier joined host over lexicographically smaller uid", () => {
    const players = [
      { id: "host-creator", joinedAt: 10, orderIndex: 0, isOnline: true, name: "Host" },
      { id: "guest-a", joinedAt: 30, orderIndex: 0, isOnline: true, name: "Guest" },
      { id: "aaa-third", joinedAt: 40, orderIndex: 0, isOnline: true, name: "AAA" },
    ];

    expect(selectHostCandidate(players)).toBe("host-creator");
  });

  test("evaluateClaim does not reassign when current host remains", () => {
    const manager = new HostManager({
      roomId: "room-1",
      currentHostId: "host-1",
      players: mapPlayers(),
    });

    expect(manager.evaluateClaim("guest-1")).toEqual({
      action: "none",
      reason: "host-present",
      hostId: "host-1",
    });
  });

  test("evaluateClaim auto-assigns to primary candidate when host is missing", () => {
    const manager = new HostManager({
      roomId: "room-1",
      currentHostId: null,
      players: mapPlayers(),
    });

    expect(manager.evaluateClaim("guest-2")).toEqual({
      action: "assign",
      reason: "auto-assign",
      hostId: "host-1",
    });
  });

  test("evaluateAfterLeave transfers host to next player when current host leaves", () => {
    const manager = new HostManager({
      roomId: "room-1",
      currentHostId: "host-1",
      leavingUid: "host-1",
      players: mapPlayers([{ }, { joinedAt: 15 }, { joinedAt: 25 }]),
    });

    expect(manager.evaluateAfterLeave()).toEqual({
      action: "assign",
      reason: "host-left",
      hostId: "guest-1",
    });
  });

  test("evaluateAfterLeave clears host when room becomes empty", () => {
    const manager = new HostManager({
      roomId: "room-1",
      currentHostId: "host-1",
      leavingUid: "host-1",
      players: [],
    });

    expect(manager.evaluateAfterLeave()).toEqual({ action: "clear", reason: "no-players" });
  });

  test("getPlayerMeta returns stored name for the selected host", () => {
    const manager = new HostManager({
      roomId: "room-1",
      currentHostId: null,
      players: mapPlayers([{ name: " Host " }]),
    });

    const decision = manager.evaluateClaim("guest-1");
    expect(decision.action).toBe("assign");
    if (decision.action !== "assign") {
      throw new Error("expected host reassignment to occur");
    }
    expect(manager.getPlayerMeta(decision.hostId)).toEqual({ name: " Host " });
  });
});
