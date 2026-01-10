import {
  areAllCluesReady,
  collectServerAssignedSeatIds,
  computeSlotCount,
  computeVisibleProposal,
  getClueTargetIds,
  getPresenceEligibleIds,
  isRevealing,
  prioritizeHostId,
} from "@/lib/game/selectors";

describe("lib/game/selectors", () => {
  describe("getPresenceEligibleIds", () => {
    test("blocks when presence is not ready and onlineUids is empty by default", () => {
      expect(
        getPresenceEligibleIds({
          baseIds: ["a", "b"],
          onlineUids: [],
          presenceReady: false,
        })
      ).toEqual([]);
    });

    test("falls back to baseIds when presence is not ready and blocking is disabled", () => {
      expect(
        getPresenceEligibleIds({
          baseIds: ["a", "b"],
          onlineUids: [],
          presenceReady: false,
          blockWhenNotReadyEmpty: false,
        })
      ).toEqual(["a", "b"]);
    });

    test("when presence is ready, filters to online ids but appends missing ids to preserve seat order", () => {
      expect(
        getPresenceEligibleIds({
          baseIds: ["a", "b", "c"],
          onlineUids: ["c", "a"],
          presenceReady: true,
        })
      ).toEqual(["a", "c", "b"]);
    });

    test("when filter would be empty, falls back to baseIds", () => {
      expect(
        getPresenceEligibleIds({
          baseIds: ["a", "b"],
          onlineUids: ["x", "y"],
          presenceReady: true,
        })
      ).toEqual(["a", "b"]);
    });
  });

  describe("prioritizeHostId", () => {
    test("moves host to front when present", () => {
      expect(prioritizeHostId({ eligibleIds: ["a", "b", "c"], hostId: "c" })).toEqual([
        "c",
        "a",
        "b",
      ]);
    });

    test("returns as-is when host is missing or already first", () => {
      expect(prioritizeHostId({ eligibleIds: ["a", "b"], hostId: "x" })).toEqual(["a", "b"]);
      expect(prioritizeHostId({ eligibleIds: ["a", "b"], hostId: "a" })).toEqual(["a", "b"]);
    });
  });

  describe("getClueTargetIds", () => {
    test("prefers dealPlayers when it contains at least one non-empty string", () => {
      expect(getClueTargetIds({ dealPlayers: ["a", "", 123], eligibleIds: ["x"] })).toEqual(["a"]);
    });

    test("falls back to eligibleIds when dealPlayers is empty/invalid", () => {
      expect(getClueTargetIds({ dealPlayers: [], eligibleIds: ["a", "b"] })).toEqual(["a", "b"]);
      expect(getClueTargetIds({ dealPlayers: null, eligibleIds: ["a", "b"] })).toEqual([
        "a",
        "b",
      ]);
    });
  });

  describe("areAllCluesReady", () => {
    test("returns false when targetIds is empty", () => {
      expect(areAllCluesReady({ players: [{ id: "a", ready: true }], targetIds: [] })).toBe(false);
    });

    test("returns true when all matched target players are ready", () => {
      expect(
        areAllCluesReady({
          players: [
            { id: "a", ready: true },
            { id: "b", ready: true },
            { id: "c", ready: false },
          ],
          targetIds: ["a", "b"],
        })
      ).toBe(true);
    });

    test("returns false if any matched target player is not ready", () => {
      expect(
        areAllCluesReady({
          players: [
            { id: "a", ready: true },
            { id: "b", ready: false },
          ],
          targetIds: ["a", "b"],
        })
      ).toBe(false);
    });
  });

  describe("computeVisibleProposal", () => {
    test("returns orderList as-is in reveal/finished", () => {
      expect(
        computeVisibleProposal({
          status: "reveal",
          orderList: ["a", "b"],
          proposal: ["b", "a"],
          eligibleIds: ["a"],
        })
      ).toEqual(["a", "b"]);
      expect(
        computeVisibleProposal({
          status: "finished",
          orderList: ["a", "b"],
          proposal: ["b", "a"],
          eligibleIds: ["a"],
        })
      ).toEqual(["a", "b"]);
    });

    test("in clue, filters proposal by eligibleIds, else falls back to filtered orderList", () => {
      expect(
        computeVisibleProposal({
          status: "clue",
          orderList: ["a", "b"],
          proposal: ["x", "a"],
          eligibleIds: ["a", "b"],
        })
      ).toEqual(["a"]);

      expect(
        computeVisibleProposal({
          status: "clue",
          orderList: ["b", "a"],
          proposal: ["x"],
          eligibleIds: ["a", "b"],
        })
      ).toEqual(["b", "a"]);
    });
  });

  describe("collectServerAssignedSeatIds", () => {
    test("collects unique ids across dealPlayers/orderList/proposal with normalization", () => {
      const assigned = collectServerAssignedSeatIds({
        dealPlayers: ["a", "", null, "b"],
        orderList: ["c", "a"],
        proposal: ["d", 123, null],
      });

      expect([...assigned].sort()).toEqual(["a", "b", "c", "d"]);
    });
  });

  describe("computeSlotCount", () => {
    test("uses orderList length in reveal/finished", () => {
      expect(
        computeSlotCount({
          status: "reveal",
          orderList: ["a", "b", "c"],
          presenceReady: false,
          playersCount: 5,
        })
      ).toBe(3);
    });

    test("prefers online count (optionally filtered by playerIds) when presence is ready", () => {
      expect(
        computeSlotCount({
          status: "clue",
          proposal: ["a", "b", null],
          dealPlayers: ["a"],
          presenceReady: true,
          onlineUids: ["a", "b", "x"],
          playerIds: ["a", "b"],
          playersCount: 1,
        })
      ).toBe(2);
    });

    test("uses full onlineUids length when playerIds is missing", () => {
      expect(
        computeSlotCount({
          status: "clue",
          proposal: ["a"],
          dealPlayers: [],
          presenceReady: true,
          onlineUids: ["a", "b", "c"],
          playersCount: 1,
        })
      ).toBe(3);
    });

    test("falls back to max(propLen, dealLen, playersCount) when presence is not ready or online is empty", () => {
      expect(
        computeSlotCount({
          status: "clue",
          proposal: ["a", "b", null],
          dealPlayers: ["a"],
          presenceReady: false,
          onlineUids: ["a", "b"],
          playersCount: 5,
        })
      ).toBe(5);
    });
  });

  describe("isRevealing", () => {
    test("true in reveal status or when gated locally", () => {
      expect(isRevealing({ status: "reveal" })).toBe(true);
      expect(isRevealing({ status: "clue", localHide: true })).toBe(true);
      expect(isRevealing({ status: "clue", uiRevealPending: true })).toBe(true);
      expect(isRevealing({ status: "clue" })).toBe(false);
    });
  });
});
