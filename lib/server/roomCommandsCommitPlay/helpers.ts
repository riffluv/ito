import type { OrderState } from "@/lib/game/rules";
import type { RoomDoc } from "@/lib/types";

export function isPlayerMismatch(params: { uid: string; playerId: string }): boolean {
  return params.uid !== params.playerId;
}

export function deriveAllowContinue(room: RoomDoc): boolean {
  return !!room?.options?.allowContinueAfterFail;
}

export function deriveRoundPlayers(room: RoomDoc): string[] | null {
  return Array.isArray(room?.deal?.players) ? (room.deal!.players as string[]) : null;
}

export function deriveRoundTotal(roundPlayers: string[] | null): number | null {
  return roundPlayers ? roundPlayers.length : null;
}

export function buildCurrentOrderState(params: {
  room: RoomDoc;
  decidedAtMs: number;
  nowMs: number;
  roundTotal: number | null;
}): OrderState {
  return {
    list: Array.isArray(params.room?.order?.list) ? [...params.room.order!.list] : [],
    lastNumber:
      typeof params.room?.order?.lastNumber === "number" ? params.room.order.lastNumber : null,
    failed: !!params.room?.order?.failed,
    failedAt:
      typeof params.room?.order?.failedAt === "number" ? params.room.order.failedAt : null,
    decidedAt: params.decidedAtMs > 0 ? params.decidedAtMs : params.nowMs,
    total:
      typeof params.roundTotal === "number"
        ? params.roundTotal
        : typeof params.room?.order?.total === "number"
          ? params.room.order.total
          : undefined,
  } as OrderState;
}

