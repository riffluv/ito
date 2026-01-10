import type { RoomDoc } from "@/lib/types";

export function getExistingDealCount(room: RoomDoc | undefined): number | null {
  const players = room?.deal?.players;
  return Array.isArray(players) ? players.length : null;
}

export function shouldReturnIdempotentDealCount(params: {
  dealRequestId: string | null;
  requestId: string;
  existingDealCount: number | null;
}): number | null {
  if (!params.dealRequestId) return null;
  if (params.dealRequestId !== params.requestId) return null;
  if (params.existingDealCount === null) return null;
  return params.existingDealCount;
}

export function deriveIsFirstDeal(existingNumbers: unknown): boolean {
  if (!existingNumbers || typeof existingNumbers !== "object") return true;
  try {
    return Object.keys(existingNumbers as Record<string, unknown>).length === 0;
  } catch {
    return true;
  }
}

export function canBypassDealRateLimit(params: {
  isFirstDeal: boolean;
  status: RoomDoc["status"] | null;
}): boolean {
  if (!params.isFirstDeal) return false;
  return params.status === "clue" || params.status === "waiting";
}

export type DealCandidate = { id: string; uid?: string | undefined };

export function sortDealCandidates<T extends DealCandidate>(candidates: readonly T[]): T[] {
  return [...candidates].sort((a, b) =>
    String(a.uid || a.id).localeCompare(String(b.uid || b.id))
  );
}

export function countEligibleUids(candidates: readonly DealCandidate[]): number {
  return candidates.filter((c) => typeof c.uid === "string" && c.uid.trim().length > 0).length;
}

export function shouldFallbackDealTarget(params: {
  eligibleCount: number;
  orderedCount: number;
}): boolean {
  return params.eligibleCount > 1 && params.orderedCount <= 1;
}

export function maybeFallbackDealTarget<T extends DealCandidate>(params: {
  ordered: readonly T[];
  candidates: readonly T[];
  eligibleCount: number;
}): T[] {
  if (!shouldFallbackDealTarget({ eligibleCount: params.eligibleCount, orderedCount: params.ordered.length })) {
    return [...params.ordered];
  }
  const fallbackOrdered = sortDealCandidates(params.candidates);
  if (fallbackOrdered.length > params.ordered.length) {
    return fallbackOrdered;
  }
  return [...params.ordered];
}

