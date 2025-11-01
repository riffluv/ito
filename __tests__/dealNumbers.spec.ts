import { selectDealTargetPlayers } from "@/lib/game/room";
import { ACTIVE_WINDOW_MS } from "@/lib/time";

describe("selectDealTargetPlayers", () => {
  const now = 1_000_000;

  const makeCandidate = (id: string, lastSeenOffsetMs: number) => ({
    id,
    lastSeen: now - lastSeenOffsetMs,
  });

  test("prefers presence-listed players when available", () => {
    const candidates = [
      makeCandidate("alice", 1_000),
      makeCandidate("bob", 1_000),
    ];
    const result = selectDealTargetPlayers(candidates, ["alice"], now);
    expect(result.map((p) => p.id)).toEqual(["alice", "bob"]);
  });

  test("falls back to recent activity when presence is empty", () => {
    const candidates = [
      makeCandidate("alice", 1_000),
      makeCandidate("bob", ACTIVE_WINDOW_MS * 5),
    ];
    const result = selectDealTargetPlayers(candidates, [], now);
    expect(result.map((p) => p.id)).toEqual(["alice"]);
  });

  test("ignores presence entries that are not room players", () => {
    const candidates = [
      makeCandidate("alice", 1_000),
      makeCandidate("bob", 1_000),
    ];
    const result = selectDealTargetPlayers(candidates, ["ghost"], now);
    expect(result.map((p) => p.id).sort()).toEqual(["alice", "bob"]);
  });
});
