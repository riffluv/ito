"use client";

import {
  getPresenceEligibleIds,
  prioritizeHostId,
} from "@/lib/game/selectors";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { sortPlayersByJoinOrder } from "@/lib/utils";
import { useMemo } from "react";

type RoomPlayer = PlayerDoc & { id: string };

type UseRoomEligibleIdsParams = {
  room: RoomDoc;
  players: RoomPlayer[];
  onlineUids: string[] | null | undefined;
  presenceReady: boolean;
};

export function useRoomEligibleIds(params: UseRoomEligibleIdsParams) {
  const { room, players, onlineUids, presenceReady } = params;

  const unsortedBaseIds = useMemo(() => {
    const dealPlayers = room?.deal?.players;
    if (Array.isArray(dealPlayers)) {
      const combined = new Set<string>([
        ...dealPlayers,
        ...players.map((player) => player.id),
      ]);
      return Array.from(combined);
    }
    return players.map((player) => player.id);
  }, [room?.deal?.players, players]);

  const baseIds = useMemo(
    () => sortPlayersByJoinOrder(unsortedBaseIds, players),
    [unsortedBaseIds, players]
  );

  const presenceEligibleIds = useMemo(
    () =>
      getPresenceEligibleIds({
        baseIds,
        onlineUids,
        presenceReady,
        // 表示・UI側はフォールバックを優先し、START/DEAL の厳密ガードは FSM 側で担保する
        blockWhenNotReadyEmpty: false,
      }),
    [baseIds, presenceReady, onlineUids]
  );

  const hostId = room?.hostId ?? null;
  const eligibleIds = useMemo(
    () => prioritizeHostId({ eligibleIds: presenceEligibleIds, hostId }),
    [hostId, presenceEligibleIds]
  );

  return { baseIds, eligibleIds } as const;
}

