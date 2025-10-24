import { test, expect } from "@playwright/test";
import { selectDealTargetPlayers } from "../lib/game/room";
import {
  applyPlay,
  defaultOrderState,
  shouldFinishAfterPlay,
} from "../lib/game/rules";

test("round finishes even when an offline player is removed from deal", () => {
  const now = 1_000_000;
  const candidates = [
    { id: "host", lastSeen: now - 1_000 },
    { id: "alice", lastSeen: now - 3_000 },
    // bob は最後の履歴が古く、presenceにもいない → 配札から除外される
    { id: "bob", lastSeen: now - 120_000 },
  ];
  const presenceOnline = ["host", "alice"];

  const deal = selectDealTargetPlayers(candidates, presenceOnline, now);
  expect(deal.map((p) => p.id)).toEqual(["host", "alice"]);

  const allowContinue = false;
  const total = deal.length;
  let order = defaultOrderState();

  const firstPlay = applyPlay({
    order,
    playerId: "host",
    myNum: 12,
    allowContinue,
  }).next;
  expect(
    shouldFinishAfterPlay({
      nextListLength: firstPlay.list.length,
      total,
      presenceCount: null,
      nextFailed: firstPlay.failed,
      allowContinue,
    })
  ).toBe(false);

  const secondPlay = applyPlay({
    order: firstPlay,
    playerId: "alice",
    myNum: 58,
    allowContinue,
  }).next;
  expect(secondPlay.failed).toBe(false);
  expect(
    shouldFinishAfterPlay({
      nextListLength: secondPlay.list.length,
      total,
      presenceCount: null,
      nextFailed: secondPlay.failed,
      allowContinue,
    })
  ).toBe(true);
});

