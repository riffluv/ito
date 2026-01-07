"use client";

import { setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import {
  applyPlayerPatch,
  mergePlayersWithOptimisticPatches,
  PLAYER_OPTIMISTIC_PATCH_EVENT,
  type OptimisticPlayerPatchEntry,
  type PlayerOptimisticPatchEventDetail,
} from "@/lib/hooks/roomSnapshotOptimisticPatches";
import type { PlayerDoc } from "@/lib/types";
import deepEqual from "fast-deep-equal/es6";
import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { unstable_batchedUpdates } from "react-dom";

export function useRoomSnapshotOptimisticPlayers(params: {
  roomId: string;
  leavingRef: MutableRefObject<boolean>;
  fetchedPlayers: (PlayerDoc & { id: string })[];
  partLoading: boolean;
  enqueueCommit: (task: () => void, startedAt: number | null, metricKey?: string) => void;
  setPlayers: Dispatch<SetStateAction<(PlayerDoc & { id: string })[]>>;
}) {
  const { roomId, leavingRef, fetchedPlayers, partLoading, enqueueCommit, setPlayers } = params;

  const optimisticPlayerPatchesRef = useRef<Record<string, OptimisticPlayerPatchEntry>>({});

  // Optimistic player patches (e.g. clue submit) to avoid waiting for server propagation.
  useEffect(() => {
    if (typeof window === "undefined") return () => undefined;
    if (!roomId) return () => undefined;

    const handler = (event: Event) => {
      if (leavingRef.current) return;
      const detail = (event as CustomEvent<PlayerOptimisticPatchEventDetail>).detail;
      if (!detail || typeof detail !== "object") return;
      if (detail.roomId !== roomId) return;
      if (typeof detail.playerId !== "string" || detail.playerId.trim().length === 0) return;
      if (detail.op !== "apply" && detail.op !== "rollback") return;
      if (typeof detail.seq !== "number" || !Number.isFinite(detail.seq)) return;

      const playerId = detail.playerId;
      const reason =
        typeof detail.reason === "string" && detail.reason.trim().length > 0
          ? detail.reason.trim().slice(0, 80)
          : "unknown";
      const now = Date.now();

      if (detail.op === "apply") {
        const patch = (detail.patch ?? {}) as Partial<Pick<PlayerDoc, "clue1" | "ready">>;
        const prev = (detail.prev ?? {}) as Partial<Pick<PlayerDoc, "clue1" | "ready">>;
        optimisticPlayerPatchesRef.current[playerId] = {
          seq: detail.seq,
          reason,
          appliedAt: now,
          patch,
          prev,
        };
        enqueueCommit(() => {
          setPlayers((prevPlayers) => applyPlayerPatch(prevPlayers, playerId, patch));
        }, typeof performance !== "undefined" ? performance.now() : null, "participantsOptimisticCommitMs");
        try {
          traceAction("clue.optimistic.apply", {
            roomId,
            playerId,
            seq: String(detail.seq),
            reason,
          });
        } catch {}
        try {
          setMetric("participants", "optimistic.lastApply", `${reason}:${playerId}:${detail.seq}`);
        } catch {}
        return;
      }

      const existing = optimisticPlayerPatchesRef.current[playerId];
      if (!existing || existing.seq !== detail.seq) {
        return;
      }
      const rollbackPatch = existing.prev;
      delete optimisticPlayerPatchesRef.current[playerId];
      enqueueCommit(() => {
        setPlayers((prevPlayers) => applyPlayerPatch(prevPlayers, playerId, rollbackPatch));
      }, typeof performance !== "undefined" ? performance.now() : null, "participantsOptimisticCommitMs");
      try {
        traceAction("clue.optimistic.rollback", {
          roomId,
          playerId,
          seq: String(detail.seq),
          reason,
        });
      } catch {}
      try {
        setMetric("participants", "optimistic.lastRollback", `${reason}:${playerId}:${detail.seq}`);
      } catch {}
    };

    window.addEventListener(PLAYER_OPTIMISTIC_PATCH_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(PLAYER_OPTIMISTIC_PATCH_EVENT, handler as EventListener);
    };
  }, [enqueueCommit, leavingRef, roomId, setPlayers]);

  useEffect(() => {
    // Confirm optimistic patches when Firestore catches up.
    const patches = optimisticPlayerPatchesRef.current;
    const patchIds = Object.keys(patches);
    if (patchIds.length > 0) {
      for (const playerId of patchIds) {
        const entry = patches[playerId];
        if (!entry) continue;
        const player = fetchedPlayers.find((p) => p.id === playerId);
        if (!player) continue;
        const patchClue =
          typeof entry.patch.clue1 === "string" ? entry.patch.clue1 : undefined;
        const patchReady =
          typeof entry.patch.ready === "boolean" ? entry.patch.ready : undefined;
        const clueOk = patchClue === undefined || player.clue1 === patchClue;
        const readyOk = patchReady === undefined || player.ready === patchReady;
        if (clueOk && readyOk) {
          const confirmMs = Math.max(0, Date.now() - entry.appliedAt);
          delete patches[playerId];
          try {
            setMetric("participants", "optimistic.confirmMs", confirmMs);
            setMetric("participants", "optimistic.confirmReason", entry.reason);
          } catch {}
          try {
            traceAction("clue.optimistic.confirm", {
              roomId,
              playerId,
              seq: String(entry.seq),
              reason: entry.reason,
              confirmMs: String(confirmMs),
            });
          } catch {}
        }
      }
    }

    const mergedPlayers = mergePlayersWithOptimisticPatches(
      fetchedPlayers,
      optimisticPlayerPatchesRef.current
    );
    const startedAt = typeof performance !== "undefined" ? performance.now() : null;
    enqueueCommit(() => {
      unstable_batchedUpdates(() => {
        setPlayers((prev) => (deepEqual(prev, mergedPlayers) ? prev : mergedPlayers));
      });
    }, startedAt, "participantsCommitMs");
  }, [enqueueCommit, fetchedPlayers, partLoading, roomId, setPlayers]);
}

