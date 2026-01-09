import { createPlayersSignature } from "@/lib/hooks/participants/createPlayersSignature";
import {
  deriveEffectiveOnlineUids,
  deriveParticipants,
} from "@/lib/hooks/participants/deriveParticipants";

describe("participants derivations", () => {
  test("createPlayersSignature encodes stable fields", () => {
    const a = {
      id: "a",
      ready: true,
      number: 3,
      orderIndex: 1,
      clue1: "foo",
    } as any;
    const b = {
      id: "b",
      ready: false,
      number: undefined,
      orderIndex: undefined,
      clue1: undefined,
    } as any;

    expect(createPlayersSignature([a, b])).toBe("a|1|3|1|foo;b|0|_|_|");
    expect(createPlayersSignature([])).toBe("");
  });

  test("deriveEffectiveOnlineUids matches hook behavior", () => {
    expect(
      deriveEffectiveOnlineUids({
        presenceReady: true,
        presenceDegraded: false,
        onlineUids: ["u1"],
        stableOnlineUids: ["s1"],
      })
    ).toEqual(["u1"]);

    expect(
      deriveEffectiveOnlineUids({
        presenceReady: false,
        presenceDegraded: true,
        onlineUids: undefined,
        stableOnlineUids: ["s1", "s2"],
      })
    ).toEqual(["s1", "s2"]);

    expect(
      deriveEffectiveOnlineUids({
        presenceReady: false,
        presenceDegraded: false,
        onlineUids: ["u1"],
        stableOnlineUids: ["s1"],
      })
    ).toEqual(["u1"]);
  });

  test("deriveParticipants filters only when presence is ready or degraded", () => {
    const players = [{ id: "u1" }, { id: "u2" }] as any[];

    expect(
      deriveParticipants({
        players: players as any,
        effectiveOnlineUids: ["u1"],
        presenceReady: false,
        presenceDegraded: false,
      })
    ).toEqual(players);

    expect(
      deriveParticipants({
        players: players as any,
        effectiveOnlineUids: [],
        presenceReady: true,
        presenceDegraded: false,
      })
    ).toEqual([]);

    expect(
      deriveParticipants({
        players: players as any,
        effectiveOnlineUids: ["u2"],
        presenceReady: true,
        presenceDegraded: false,
      })
    ).toEqual([{ id: "u2" }]);

    expect(
      deriveParticipants({
        players: players as any,
        effectiveOnlineUids: ["u2"],
        presenceReady: false,
        presenceDegraded: true,
      })
    ).toEqual([{ id: "u2" }]);
  });
});

