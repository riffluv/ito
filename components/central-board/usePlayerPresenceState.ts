"use client";

import { useMemo, useRef } from "react";

import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";

interface PlayerPresenceOptions {
  players: (PlayerDoc & { id: string })[];
  orderList: (string | null)[];
  proposal?: (string | null)[];
  orderSnapshots?: Record<string, PlayerSnapshot> | null;
  eligibleIds?: string[];
  meId: string;
  roomStatus: RoomDoc["status"];
  dealPlayers?: string[] | null;
}

export function usePlayerPresenceState({
  players,
  orderList,
  proposal,
  orderSnapshots,
  eligibleIds,
  meId,
  roomStatus,
  dealPlayers,
}: PlayerPresenceOptions) {
  const lastKnownCardRef = useRef(new Map<string, PlayerDoc & { id: string }>());

  const playerMap = useMemo(() => {
    const map = new Map<string, PlayerDoc & { id: string }>();
    players.forEach((player) => {
      if (player && player.id) {
        map.set(player.id, player);
      }
    });
    if (orderSnapshots && typeof orderSnapshots === "object") {
      Object.entries(orderSnapshots).forEach(([id, snapshot]) => {
        if (!snapshot || map.has(id)) return;
        map.set(id, {
          id,
          name: typeof snapshot.name === "string" && snapshot.name.trim() ? snapshot.name : "離脱プレイヤー",
          avatar:
            typeof snapshot.avatar === "string" && snapshot.avatar.trim()
              ? snapshot.avatar
              : "/avatars/knight1.webp",
          clue1: typeof snapshot.clue1 === "string" ? snapshot.clue1 : "",
          number: typeof snapshot.number === "number" ? snapshot.number : null,
          ready: true,
          orderIndex: 0,
        });
      });
    }
    const relevantIds = new Set<string>();
    if (Array.isArray(orderList)) {
      orderList.forEach((value) => {
        if (typeof value === "string" && value.trim()) relevantIds.add(value);
      });
    }
    if (Array.isArray(proposal)) {
      proposal.forEach((value) => {
        if (typeof value === "string" && value.trim()) relevantIds.add(value);
      });
    }
    if (orderSnapshots && typeof orderSnapshots === "object") {
      Object.keys(orderSnapshots).forEach((id) => {
        if (typeof id === "string" && id.trim()) relevantIds.add(id);
      });
    }
    const lastKnown = lastKnownCardRef.current;
    map.forEach((player, id) => {
      lastKnown.set(id, {
        id,
        name: player?.name ?? "",
        avatar: player?.avatar ?? "",
        clue1: typeof player?.clue1 === "string" ? player.clue1 : "",
        number: typeof player?.number === "number" ? player.number : null,
        ready: true,
        orderIndex: typeof player?.orderIndex === "number" ? player.orderIndex : 0,
      });
    });
    relevantIds.forEach((id) => {
      if (!map.has(id)) {
        const fallback = lastKnown.get(id);
        if (fallback) {
          map.set(id, fallback);
        }
      }
    });
    return map;
  }, [players, orderList, proposal, orderSnapshots]);

  const eligibleIdsKey = useMemo(
    () => (Array.isArray(eligibleIds) ? eligibleIds.join(",") : ""),
    [eligibleIds]
  );

  const eligibleIdSet = useMemo(() => {
    const set = new Set<string>();
    if (!eligibleIdsKey && (!eligibleIds || eligibleIds.length === 0)) {
      return set;
    }
    (eligibleIds || []).forEach((id) => {
      if (playerMap.has(id)) set.add(id);
    });
    return set;
  }, [eligibleIds, eligibleIdsKey, playerMap]);

  const me = useMemo(() => playerMap.get(meId), [playerMap, meId]);
  const hasNumber = useMemo(() => !!me?.number, [me?.number]);

  const mePlaced = useMemo(() => {
    if (!meId) return false;
    const containsId = (list?: (string | null)[] | null) =>
      Array.isArray(list) && list.some((id) => typeof id === "string" && id.length > 0 && id === meId);
    return containsId(orderList) || containsId(proposal);
  }, [orderList, proposal, meId]);

  const availableEligibleCount = useMemo(() => {
    if (!Array.isArray(eligibleIds)) return 0;
    let count = 0;
    eligibleIds.forEach((id) => {
      if (playerMap.has(id)) {
        count += 1;
      }
    });
    return count;
  }, [eligibleIds, playerMap]);

  const normalizedDealPlayers = useMemo(() => {
    if (!Array.isArray(dealPlayers)) return null;
    const filtered = dealPlayers.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0
    );
    return filtered.length > 0 ? filtered : null;
  }, [dealPlayers]);

  const dealReadyForMe = useMemo(() => {
    if (!me) return true;
    if (roomStatus !== "clue") return true;
    if (typeof me.number === "number") return true;
    if (!normalizedDealPlayers) return true;
    return normalizedDealPlayers.includes(meId);
  }, [me, roomStatus, normalizedDealPlayers, meId]);

  const dealGuardActive = useMemo(
    () => Boolean(me) && roomStatus === "clue" && normalizedDealPlayers !== null && !dealReadyForMe,
    [dealReadyForMe, me, normalizedDealPlayers, roomStatus]
  );

  return {
    playerMap,
    eligibleIdSet,
    me,
    hasNumber,
    mePlaced,
    availableEligibleCount,
    dealReadyForMe,
    dealGuardActive,
  };
}
