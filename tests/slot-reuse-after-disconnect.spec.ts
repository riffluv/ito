import { test, expect } from "@playwright/test";

import type { PlayerDoc } from "../lib/types";
import { buildPlayerPresenceSnapshot } from "../components/central-board/usePlayerPresenceState";

const createPlayer = (
  id: string,
  overrides: Partial<PlayerDoc> = {}
): PlayerDoc & { id: string } => ({
  id,
  name: overrides.name ?? `Player-${id}`,
  avatar: overrides.avatar ?? "/avatars/knight1.webp",
  clue1: overrides.clue1 ?? "hint",
  number: overrides.number ?? 42,
  ready: overrides.ready ?? true,
  orderIndex: overrides.orderIndex ?? 0,
});

test("creates placeholder entries for proposal ids missing in players collection", () => {
  const lastKnown = new Map<string, PlayerDoc & { id: string }>();
  const { playerMap, placeholderIds } = buildPlayerPresenceSnapshot({
    players: [createPlayer("host")],
    orderList: [],
    proposal: ["ghost", "host"],
    orderSnapshots: null,
    lastKnown,
  });

  expect(playerMap.has("ghost")).toBeTruthy();
  expect(placeholderIds).toContain("ghost");
  const ghost = playerMap.get("ghost");
  expect(ghost?.name).toContain("離脱");
  expect(ghost?.clue1).toContain("切断");
});

test("restores real data once the ghost player rejoins", () => {
  const lastKnown = new Map<string, PlayerDoc & { id: string }>();

  // First pass simulates joining after the player disconnected
  buildPlayerPresenceSnapshot({
    players: [createPlayer("alpha")],
    orderList: [],
    proposal: ["ghost"],
    orderSnapshots: null,
    lastKnown,
  });

  // Next pass simulates the player reappearing with real data
  const { playerMap, placeholderIds } = buildPlayerPresenceSnapshot({
    players: [createPlayer("ghost", { clue1: "real-clue", number: 77 })],
    orderList: [],
    proposal: ["ghost"],
    orderSnapshots: null,
    lastKnown,
  });

  expect(placeholderIds).toHaveLength(0);
  const ghost = playerMap.get("ghost");
  expect(ghost?.clue1).toBe("real-clue");
  expect(ghost?.number).toBe(77);
});
