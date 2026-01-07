"use client";

import { computeSlotCount } from "@/lib/game/selectors";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { useMemo } from "react";

type RoomPlayer = PlayerDoc & { id: string };

type UseRoomBoardDerivationsParams = {
  room: RoomDoc;
  orderList: unknown;
  roomDealPlayers: unknown;
  orderProposal: unknown;
  players: RoomPlayer[];
  playersWithOptimistic: RoomPlayer[];
  eligibleIds: string[];
  presenceReady: boolean;
  onlineUids: string[] | null | undefined;
  meId: string;
  isMember: boolean;
};

export function useRoomBoardDerivations(params: UseRoomBoardDerivationsParams) {
  const {
    room,
    orderList,
    roomDealPlayers,
    orderProposal,
    players,
    playersWithOptimistic,
    eligibleIds,
    presenceReady,
    onlineUids,
    meId,
    isMember,
  } = params;

  const slotCount = useMemo(
    () =>
      computeSlotCount({
        status: room?.status || "waiting",
        orderList: Array.isArray(orderList) ? orderList : [],
        dealPlayers: Array.isArray(roomDealPlayers) ? roomDealPlayers : [],
        proposal: Array.isArray(orderProposal) ? orderProposal : [],
        presenceReady,
        onlineUids,
        playersCount: playersWithOptimistic.length,
        playerIds: playersWithOptimistic.map((player) => player.id),
      }),
    [
      room?.status,
      orderList,
      roomDealPlayers,
      orderProposal,
      presenceReady,
      onlineUids,
      playersWithOptimistic,
    ]
  );

  const submittedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    const proposal = Array.isArray(orderProposal) ? orderProposal : null;
    if (proposal) {
      proposal.forEach((pid) => {
        if (typeof pid === "string" && pid.trim().length > 0) ids.add(pid);
      });
    }
    const list = Array.isArray(orderList) ? orderList : null;
    if (list) {
      list.forEach((pid) => {
        if (typeof pid === "string" && pid.trim().length > 0) ids.add(pid);
      });
    }
    return Array.from(ids);
  }, [orderProposal, orderList]);

  const canStartSorting = useMemo(() => {
    const resolveMode = room?.options?.resolveMode;
    const roomStatus = room?.status;
    if (resolveMode !== "sort-submit" || roomStatus !== "clue") return false;
    const playerMap = new Map(players.map((player) => [player.id, player]));
    const placedIds = new Set(Array.isArray(orderProposal) ? orderProposal : []);
    let waitingCount = 0;
    for (const id of eligibleIds) {
      const candidate = playerMap.get(id);
      if (candidate && !placedIds.has(candidate.id)) waitingCount += 1;
    }
    return waitingCount === 0;
  }, [orderProposal, room?.options?.resolveMode, room?.status, players, eligibleIds]);

  const meHasPlacedCard = submittedPlayerIds.includes(meId);

  const baseOverlayMessage = useMemo(() => {
    if (!isMember) {
      return null;
    }
    const playerCount = playersWithOptimistic.length;
    const status = room?.status ?? null;
    if (status === "waiting") {
      return `メンバー待機中（参加人数：${playerCount}人）`;
    }
    if (status === "clue") {
      return "連想ワード入力中";
    }
    if (status === "reveal") {
      return "判定中…";
    }
    if (status === "finished") {
      return "結果を確認中…";
    }
    return null;
  }, [isMember, playersWithOptimistic.length, room?.status]);

  return {
    slotCount,
    submittedPlayerIds,
    canStartSorting,
    meHasPlacedCard,
    baseOverlayMessage,
  } as const;
}

