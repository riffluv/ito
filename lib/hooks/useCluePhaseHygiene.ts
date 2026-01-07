"use client";

import { notify } from "@/components/ui/notify";
import { PRUNE_PROPOSAL_DEBOUNCE_MS } from "@/lib/constants/uiTimings";
import { areAllCluesReady, getClueTargetIds } from "@/lib/game/selectors";
import { pruneProposalByEligible } from "@/lib/game/service";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { logDebug } from "@/lib/utils/log";
import { useCallback, useEffect, useMemo, useRef } from "react";

type RoomPlayer = PlayerDoc & { id: string };

type UseCluePhaseHygieneParams = {
  roomId: string;
  room: RoomDoc;
  players: RoomPlayer[];
  eligibleIds: string[];
  isHost: boolean;
};

export function useCluePhaseHygiene(params: UseCluePhaseHygieneParams) {
  const { roomId, room, players, eligibleIds, isHost } = params;

  const clueTargetIds = useMemo(
    () =>
      getClueTargetIds({
        dealPlayers: room?.deal?.players ?? null,
        eligibleIds,
      }),
    [room?.deal?.players, eligibleIds]
  );

  const allCluesReady = useMemo(
    () =>
      areAllCluesReady({
        players,
        targetIds: clueTargetIds,
      }),
    [players, clueTargetIds]
  );

  // 在室外IDが proposal に混入している場合の自動クリーンアップ（clue中のみ、軽いデバウンス）
  const pruneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pruneSigRef = useRef<string>("");
  useEffect(() => {
    if (!room || room.status !== "clue") {
      if (pruneTimerRef.current) {
        clearTimeout(pruneTimerRef.current);
        pruneTimerRef.current = null;
      }
      pruneSigRef.current = "";
      return () => {};
    }
    const proposal: (string | null)[] = Array.isArray(room?.order?.proposal)
      ? (room.order!.proposal as (string | null)[])
      : [];
    const extra = proposal.filter(
      (pid): pid is string => typeof pid === "string" && !eligibleIds.includes(pid)
    );
    const sig = `${roomId}|${room?.round || 0}|${proposal.join(",")}|${eligibleIds.join(",")}`;
    if (extra.length === 0 || pruneSigRef.current === sig) return () => {};
    pruneSigRef.current = sig;
    if (pruneTimerRef.current) {
      clearTimeout(pruneTimerRef.current);
      pruneTimerRef.current = null;
    }
    pruneTimerRef.current = setTimeout(() => {
      pruneProposalByEligible(roomId, eligibleIds).catch(() => {});
    }, PRUNE_PROPOSAL_DEBOUNCE_MS);
    return () => {
      if (pruneTimerRef.current) {
        clearTimeout(pruneTimerRef.current);
        pruneTimerRef.current = null;
      }
    };
  }, [
    room,
    room?.status,
    room?.order?.proposal,
    room?.round,
    eligibleIds,
    roomId,
  ]);

  const cluesReadyToastStateRef = useRef<{ round: number; ready: boolean }>({
    round: -1,
    ready: false,
  });
  const cluesReadyToastTimerRef = useRef<number | null>(null);
  const clearCluesReadyToastTimer = useCallback(() => {
    if (cluesReadyToastTimerRef.current) {
      window.clearTimeout(cluesReadyToastTimerRef.current);
      cluesReadyToastTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearCluesReadyToastTimer(), [clearCluesReadyToastTimer]);

  useEffect(() => {
    if (!room) {
      clearCluesReadyToastTimer();
      return;
    }

    const round = room?.round || 0;
    if (cluesReadyToastStateRef.current.round !== round) {
      cluesReadyToastStateRef.current = { round, ready: allCluesReady };
      clearCluesReadyToastTimer();
      return;
    }

    if (!isHost) {
      cluesReadyToastStateRef.current.ready = allCluesReady;
      clearCluesReadyToastTimer();
      return;
    }

    const status = room?.status;
    if (status !== "clue" || room?.ui?.roundPreparing || room?.ui?.revealPending) {
      cluesReadyToastStateRef.current.ready = allCluesReady;
      clearCluesReadyToastTimer();
      return;
    }

    if (!cluesReadyToastStateRef.current.ready && allCluesReady) {
      const mode = room?.options?.resolveMode || "sequential";
      const id = `clues-ready-${mode}-${roomId}-${round}`;
      clearCluesReadyToastTimer();
      cluesReadyToastTimerRef.current = window.setTimeout(() => {
        try {
          notify({
            id,
            type: "success",
            title: "全員の連想ワードが揃いました",
            description:
              "カードを全員場に置き、相談して並べ替えてから『せーので判定』を押してください",
            duration: 6000,
          });
        } catch (error) {
          logDebug("room-page", "notify-clues-ready-failed", error);
        }
      }, 420);
    }

    cluesReadyToastStateRef.current.ready = allCluesReady;
  }, [
    allCluesReady,
    clearCluesReadyToastTimer,
    isHost,
    room,
    room?.options?.resolveMode,
    room?.round,
    room?.status,
    room?.ui?.revealPending,
    room?.ui?.roundPreparing,
    roomId,
  ]);

  return { clueTargetIds, allCluesReady } as const;
}

