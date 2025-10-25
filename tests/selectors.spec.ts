import { expect, test } from "@playwright/test";
import {
  areAllCluesReady,
  getClueTargetIds,
  getPresenceEligibleIds,
} from "../lib/game/selectors";

test.describe("getPresenceEligibleIds", () => {
  test("presence 未準備なら baseIds を返す", () => {
    const base = ["a", "b", "c"];

  const result = getPresenceEligibleIds({
    baseIds: base,
    onlineUids: ["a"],
    presenceReady: false,
  });

  expect(result).toEqual(base);
  });

  test("オンラインプレイヤーのみ抽出し、空になった場合は baseIds にフォールバックする", () => {
    const base = ["p1", "p2", "p3"];

    const filtered = getPresenceEligibleIds({
      baseIds: base,
      onlineUids: ["p1", "p3"],
      presenceReady: true,
    });

    expect(filtered).toEqual(["p1", "p3"]);

    const fallback = getPresenceEligibleIds({
      baseIds: base,
      onlineUids: [],
      presenceReady: true,
    });

    expect(fallback).toEqual(base);
  });
});

test.describe("getClueTargetIds", () => {
  test("dealPlayers が有効なときはそれを優先し、不正値を除外する", () => {
    const result = getClueTargetIds({
      dealPlayers: ["a", "", 1, "b"],
      eligibleIds: ["z"],
    });

    expect(result).toEqual(["a", "b"]);
  });

  test("dealPlayers が空または未定義なら eligibleIds を返す", () => {
    const eligible = ["a", "b"];

    const emptyResult = getClueTargetIds({
      dealPlayers: [],
      eligibleIds: eligible,
    });
    expect(emptyResult).toEqual(eligible);

    const undefinedResult = getClueTargetIds({
      dealPlayers: undefined,
      eligibleIds: eligible,
    });
    expect(undefinedResult).toEqual(eligible);
  });
});

test.describe("areAllCluesReady", () => {
  const players = [
    { id: "a", ready: true },
    { id: "b", ready: true },
    { id: "c", ready: false },
  ];

  test("targetIds が空なら false", () => {
    expect(
      areAllCluesReady({
        players,
        targetIds: [],
      })
    ).toBe(false);
  });

  test("target の ready が揃っていなければ false", () => {
    expect(
      areAllCluesReady({
        players,
        targetIds: ["a", "c"],
      })
    ).toBe(false);
  });

  test("全員 ready のときのみ true", () => {
    expect(
      areAllCluesReady({
        players,
        targetIds: ["a", "b"],
      })
    ).toBe(true);
  });
});
