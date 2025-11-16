import type { RoomStats } from "@/lib/types";

export type RoomOutcome = "success" | "failure";

const ZERO_STATS: RoomStats = Object.freeze({
  gameCount: 0,
  successCount: 0,
  failureCount: 0,
  currentStreak: 0,
  bestStreak: 0,
});

const clampCount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const rounded = Math.floor(value);
  return rounded >= 0 ? rounded : 0;
};

export function createInitialRoomStats(): RoomStats {
  return { ...ZERO_STATS };
}

export function normalizeRoomStats(input: unknown): RoomStats {
  if (!input || typeof input !== "object") {
    return createInitialRoomStats();
  }
  const typed = input as Partial<RoomStats> & Record<string, unknown>;
  const currentStreak = clampCount(typed.currentStreak);
  const bestStreak = Math.max(clampCount(typed.bestStreak), currentStreak);
  return {
    gameCount: clampCount(typed.gameCount),
    successCount: clampCount(typed.successCount),
    failureCount: clampCount(typed.failureCount),
    currentStreak,
    bestStreak,
  };
}

export function applyOutcomeToRoomStats(
  previous: RoomStats | null | undefined,
  outcome: RoomOutcome
): RoomStats {
  const base = previous ?? ZERO_STATS;
  const currentStreak =
    outcome === "success" ? base.currentStreak + 1 : 0;
  return {
    gameCount: base.gameCount + 1,
    successCount: base.successCount + (outcome === "success" ? 1 : 0),
    failureCount: base.failureCount + (outcome === "failure" ? 1 : 0),
    currentStreak,
    bestStreak:
      outcome === "success"
        ? Math.max(base.bestStreak, currentStreak)
        : base.bestStreak,
  };
}
