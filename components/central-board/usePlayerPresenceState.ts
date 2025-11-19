"use client";

import { useMemo, useRef } from "react";

import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";

type PlayerWithId = PlayerDoc & { id: string };

const PLACEHOLDER_AVATAR = "/avatars/knight1.webp";
const PLACEHOLDER_CLUE = "（切断中…）";

const createPlaceholderPlayer = (id: string): PlayerWithId => ({
  id,
  name: "離脱したプレイヤー",
  avatar: PLACEHOLDER_AVATAR,
  clue1: PLACEHOLDER_CLUE,
  number: null,
  ready: true,
  orderIndex: 0,
});

export type PlayerPresenceSnapshotInput = {
  players: PlayerWithId[];
  orderList: (string | null)[];
  proposal?: (string | null)[];
  orderSnapshots?: Record<string, PlayerSnapshot> | null;
  lastKnown: Map<string, PlayerWithId>;
};

export type PlayerPresenceSnapshotResult = {
  playerMap: Map<string, PlayerWithId>;
  placeholderIds: string[];
};

export function buildPlayerPresenceSnapshot({
  players,
  orderList,
  proposal,
  orderSnapshots,
  lastKnown,
}: PlayerPresenceSnapshotInput): PlayerPresenceSnapshotResult {
  const workingMap = new Map<string, PlayerWithId>();
  players.forEach((player) => {
    if (!player || !player.id) return;
    workingMap.set(player.id, player);
  });

  if (orderSnapshots && typeof orderSnapshots === "object") {
    Object.entries(orderSnapshots).forEach(([id, snapshot]) => {
      if (!id || workingMap.has(id) || !snapshot) return;
      workingMap.set(id, {
        id,
        name:
          typeof snapshot.name === "string" && snapshot.name.trim()
            ? snapshot.name
            : "離脱したプレイヤー",
        avatar:
          typeof snapshot.avatar === "string" && snapshot.avatar.trim()
            ? snapshot.avatar
            : PLACEHOLDER_AVATAR,
        clue1: typeof snapshot.clue1 === "string" ? snapshot.clue1 : PLACEHOLDER_CLUE,
        number:
          typeof snapshot.number === "number" && Number.isFinite(snapshot.number)
            ? snapshot.number
            : null,
        ready: true,
        orderIndex: 0,
      });
    });
  }

  const relevantIds = new Set<string>();
  const register = (value: string | null | undefined) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        relevantIds.add(trimmed);
      }
    }
  };

  if (Array.isArray(orderList)) {
    orderList.forEach(register);
  }
  if (Array.isArray(proposal)) {
    proposal.forEach(register);
  }
  if (orderSnapshots && typeof orderSnapshots === "object") {
    Object.keys(orderSnapshots).forEach(register);
  }

  const placeholderIds: string[] = [];
  workingMap.forEach((player, id) => {
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
    if (workingMap.has(id)) return;
    const fallback = lastKnown.get(id);
    if (fallback) {
      workingMap.set(id, fallback);
      return;
    }
    const placeholder = createPlaceholderPlayer(id);
    workingMap.set(id, placeholder);
    lastKnown.set(id, placeholder);
    placeholderIds.push(id);
  });

  return { playerMap: workingMap, placeholderIds };
}

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
  const lastKnownCardRef = useRef(new Map<string, PlayerWithId>());

  const { playerMap, placeholderIds } = useMemo(
    () =>
      buildPlayerPresenceSnapshot({
        players,
        orderList,
        proposal,
        orderSnapshots,
        lastKnown: lastKnownCardRef.current,
      }),
    [players, orderList, proposal, orderSnapshots]
  );

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
    missingPlayerIds: placeholderIds,
    eligibleIdSet,
    me,
    hasNumber,
    mePlaced,
    availableEligibleCount,
    dealReadyForMe,
    dealGuardActive,
  };
}
