import { test, expect } from "@playwright/test";
import { selectDealTargetPlayers } from "../lib/game/room";
import { getPresenceEligibleIds, getClueTargetIds } from "../lib/game/selectors";
import { computeAllSubmitted } from "../lib/game/resolveMode";
import type { PlayerDoc, RoomDoc } from "../lib/types";
import { buildHostActionModel } from "../lib/host/hostActionsModel";
import { topicTypeLabels } from "../lib/topics";

const createPlayer = (
  id: string,
  name: string,
  opts: Partial<PlayerDoc> & { number: number | null }
): PlayerDoc & { id: string } => ({
  id,
  name,
  avatar: opts.avatar ?? "",
  number: opts.number,
  clue1: opts.clue1 ?? "",
  ready: opts.ready ?? false,
  orderIndex: opts.orderIndex ?? 0,
  uid: opts.uid ?? id,
});

const createRoom = (overrides: Partial<RoomDoc>): RoomDoc & { id?: string } => ({
  name: overrides.name ?? "テストルーム",
  hostId: overrides.hostId ?? "host",
  creatorId: overrides.creatorId ?? "host",
  options: overrides.options ?? {
    allowContinueAfterFail: true,
    resolveMode: "sort-submit",
  },
  status: overrides.status ?? "clue",
  topic: overrides.topic ?? "通常版",
  topicOptions: overrides.topicOptions ?? null,
  result: overrides.result ?? null,
  deal: overrides.deal ?? null,
  order: overrides.order ?? {
    list: [],
    proposal: [],
  },
  requiresPassword: overrides.requiresPassword ?? false,
  passwordHash: overrides.passwordHash ?? null,
  passwordSalt: overrides.passwordSalt ?? null,
  passwordVersion: overrides.passwordVersion ?? null,
  round: overrides.round ?? 1,
  mvpVotes: overrides.mvpVotes ?? null,
  createdAt: overrides.createdAt,
  lastActiveAt: overrides.lastActiveAt,
  updatePhase: overrides.updatePhase,
  requiredSwVersion: overrides.requiredSwVersion,
});

test("offline player does not block evaluate flow", () => {
  const now = Date.now();
  const candidates = [
    { id: "host", lastSeen: now - 1_000 },
    { id: "ally", lastSeen: now - 2_000 },
    // bob は離脱済み（presence から消失）
    { id: "bob", lastSeen: now - 60_000 },
  ];
  const presenceOnline = ["host", "ally"];
  const deal = selectDealTargetPlayers(candidates, presenceOnline, now);
  expect(deal.map((p) => p.id)).toEqual(["host", "ally"]);

  const players: (PlayerDoc & { id: string })[] = [
    createPlayer("host", "ホスト", { number: 12, clue1: "sun", ready: true }),
    createPlayer("ally", "味方", { number: 54, clue1: "moon", ready: true }),
    createPlayer("bob", "離脱者", { number: 88, clue1: "star", ready: false }),
  ];

  const room = createRoom({
    hostId: "host",
    status: "clue",
    deal: {
      seed: "seed-1",
      min: 1,
      max: 100,
      players: deal.map((p) => p.id),
    },
    order: {
      list: [],
      proposal: ["host", "ally"],
      total: deal.length,
    },
  });

  const intents = buildHostActionModel(
    room,
    players,
    presenceOnline.length,
    topicTypeLabels,
    null
  );
  const evaluateIntent = intents.find((intent) => intent.key === "evaluate");
  expect(evaluateIntent).toBeTruthy();
  expect(evaluateIntent?.disabled).toBeFalsy();
  expect(evaluateIntent?.reason).toBeUndefined();

  const eligibleIds = getPresenceEligibleIds({
    baseIds: players.map((p) => p.id),
    onlineUids: presenceOnline,
    presenceReady: true,
  });
  // presenceReady=true ではオンライン→オフラインの順で返る（オフラインも末尾に残す）
  expect(eligibleIds).toEqual(["host", "ally", "bob"]);

  const targetIds = getClueTargetIds({
    dealPlayers: room.deal?.players ?? null,
    eligibleIds,
  });
  expect(targetIds).toEqual(["host", "ally"]);

  const allSubmitted = computeAllSubmitted({
    mode: room.options.resolveMode,
    eligibleIds: targetIds,
    proposal: room.order?.proposal ?? [],
  });
  expect(allSubmitted).toBe(true);
});
