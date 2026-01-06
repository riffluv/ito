import {
  getClueTargetIds,
  getPresenceEligibleIds,
} from "@/lib/game/selectors";
import type { RoomMachineContext } from "./roomMachine";

export function computeEligibleIds(context: RoomMachineContext): string[] {
  const baseIds = context.players.map((player) => player.id);
  return getPresenceEligibleIds({
    baseIds,
    onlineUids: context.onlineUids,
    presenceReady: context.presenceReady,
  });
}

export function computeTargetIds(context: RoomMachineContext): string[] {
  const eligible = computeEligibleIds(context);
  return getClueTargetIds({
    dealPlayers: context.room?.deal?.players ?? null,
    eligibleIds: eligible,
  });
}

