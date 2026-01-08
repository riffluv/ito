"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UseRoomOptimisticOrderProposalParams = {
  orderProposal: unknown;
  roomStatus: string | null;
};

type OptimisticProposalOverride = {
  state: "placed" | "removed";
  targetIndex?: number;
};

export function useRoomOptimisticOrderProposal(
  params: UseRoomOptimisticOrderProposalParams
) {
  const { orderProposal, roomStatus } = params;

  const [optimisticProposalOverrides, setOptimisticProposalOverrides] = useState<
    Record<string, OptimisticProposalOverride>
  >({});

  const updateOptimisticProposalOverride = useCallback(
    (
      playerId: string,
      state: "placed" | "removed" | null,
      targetIndex?: number | null
    ) => {
      if (!playerId) return;
      setOptimisticProposalOverrides((prev) => {
        const normalizedIndex = typeof targetIndex === "number" ? targetIndex : undefined;
        const current = prev[playerId] ?? null;
        const currentState = current?.state ?? null;
        const currentIndex =
          typeof current?.targetIndex === "number" ? current.targetIndex : undefined;
        if (
          currentState === state &&
          (state === null || currentIndex === normalizedIndex)
        ) {
          return prev;
        }
        if (state === null) {
          if (!(playerId in prev)) return prev;
          const next = { ...prev };
          delete next[playerId];
          return next;
        }
        if (
          currentState === state &&
          currentIndex === normalizedIndex &&
          playerId in prev
        ) {
          return prev;
        }
        return {
          ...prev,
          [playerId]: {
            state,
            targetIndex: normalizedIndex,
          },
        };
      });
    },
    []
  );

  const sanitizedServerProposal = useMemo<(string | null)[]>(() => {
    if (!Array.isArray(orderProposal)) {
      return [];
    }
    return (orderProposal as (string | null | undefined)[]).map((value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    });
  }, [orderProposal]);

  const sanitizedServerProposalSet = useMemo(() => {
    const set = new Set<string>();
    sanitizedServerProposal.forEach((value) => {
      if (typeof value === "string" && value.length > 0) {
        set.add(value);
      }
    });
    return set;
  }, [sanitizedServerProposal]);

  useEffect(() => {
    if (!Object.keys(optimisticProposalOverrides).length) return;
    const hasServerUpdate = sanitizedServerProposalSet;
    let changed = false;
    const next: Record<string, OptimisticProposalOverride> = {};
    Object.entries(optimisticProposalOverrides).forEach(([playerId, entry]) => {
      const state = entry.state;
      const presentOnServer = hasServerUpdate.has(playerId);
      if (
        (state === "placed" && presentOnServer) ||
        (state === "removed" && !presentOnServer)
      ) {
        changed = true;
        return;
      }
      next[playerId] = entry;
    });
    if (changed) {
      setOptimisticProposalOverrides(next);
    }
  }, [sanitizedServerProposalSet, optimisticProposalOverrides]);

  useEffect(() => {
    if (roomStatus === "clue") return;
    setOptimisticProposalOverrides((prev) => (Object.keys(prev).length ? {} : prev));
  }, [roomStatus]);

  const proposalForUi = useMemo<(string | null)[]>(() => {
    const overrides = optimisticProposalOverrides;
    if (!Object.keys(overrides).length) {
      return sanitizedServerProposal;
    }
    const next = sanitizedServerProposal.slice();
    const presentSet = new Set(
      next.filter((value): value is string => typeof value === "string" && value.length > 0)
    );

    Object.entries(overrides).forEach(([playerId, entry]) => {
      if (entry.state !== "removed") return;
      for (let i = 0; i < next.length; i += 1) {
        if (next[i] === playerId) {
          next[i] = null;
        }
      }
      presentSet.delete(playerId);
    });

    Object.entries(overrides).forEach(([playerId, entry]) => {
      if (entry.state !== "placed") return;

      // Ensure uniqueness even if server data is stale.
      if (presentSet.has(playerId)) {
        for (let i = 0; i < next.length; i += 1) {
          if (next[i] === playerId) next[i] = null;
        }
        presentSet.delete(playerId);
      }

      const targetIndex =
        typeof entry.targetIndex === "number" ? Math.max(0, entry.targetIndex) : null;
      if (targetIndex !== null) {
        while (next.length <= targetIndex) {
          next.push(null);
        }
        next[targetIndex] = playerId;
        presentSet.add(playerId);
        return;
      }

      const emptyIndex = next.findIndex((slot) => slot === null);
      if (emptyIndex >= 0) {
        next[emptyIndex] = playerId;
        presentSet.add(playerId);
        return;
      }
      next.push(playerId);
      presentSet.add(playerId);
    });

    return next;
  }, [sanitizedServerProposal, optimisticProposalOverrides]);

  return {
    proposalForUi,
    updateOptimisticProposalOverride,
  } as const;
}
