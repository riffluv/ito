"use client";

import type { PlayerDoc } from "@/lib/types";
import deepEqual from "fast-deep-equal/es6";

export type PlayerOptimisticPatchEventDetail = {
  roomId: string;
  playerId: string;
  op: "apply" | "rollback";
  seq: number;
  reason?: string;
  ts?: number;
  patch?: Partial<Pick<PlayerDoc, "clue1" | "ready">>;
  prev?: Partial<Pick<PlayerDoc, "clue1" | "ready">>;
};

export const PLAYER_OPTIMISTIC_PATCH_EVENT = "ito:player-optimistic-patch";

export type OptimisticPlayerPatchEntry = {
  seq: number;
  reason: string;
  appliedAt: number;
  patch: Partial<Pick<PlayerDoc, "clue1" | "ready">>;
  prev: Partial<Pick<PlayerDoc, "clue1" | "ready">>;
};

export function applyPlayerPatch(
  list: readonly (PlayerDoc & { id: string })[],
  playerId: string,
  patch: Partial<Pick<PlayerDoc, "clue1" | "ready">>
): (PlayerDoc & { id: string })[] {
  if (!Array.isArray(list) || list.length === 0) return list.slice();
  if (!playerId) return list.slice();
  const clue1 = typeof patch.clue1 === "string" ? patch.clue1 : undefined;
  const ready = typeof patch.ready === "boolean" ? patch.ready : undefined;
  if (clue1 === undefined && ready === undefined) return list.slice();

  let changed = false;
  const next = list.map((player) => {
    if (player.id !== playerId) return player;
    const nextPlayer: PlayerDoc & { id: string } = {
      ...player,
      ...(clue1 !== undefined ? { clue1 } : {}),
      ...(ready !== undefined ? { ready } : {}),
    };
    if (!deepEqual(player, nextPlayer)) {
      changed = true;
    }
    return nextPlayer;
  });
  return changed ? next : list.slice();
}

export function mergePlayersWithOptimisticPatches(
  base: readonly (PlayerDoc & { id: string })[],
  patches: Record<string, OptimisticPlayerPatchEntry>
): (PlayerDoc & { id: string })[] {
  const ids = Object.keys(patches);
  if (!Array.isArray(base) || base.length === 0 || ids.length === 0) {
    return base.slice();
  }
  let changed = false;
  const next = base.map((player) => {
    const entry = patches[player.id];
    if (!entry) return player;
    const patch = entry.patch;
    const clue1 = typeof patch.clue1 === "string" ? patch.clue1 : undefined;
    const ready = typeof patch.ready === "boolean" ? patch.ready : undefined;
    const nextPlayer: PlayerDoc & { id: string } = {
      ...player,
      ...(clue1 !== undefined ? { clue1 } : {}),
      ...(ready !== undefined ? { ready } : {}),
    };
    if (!deepEqual(player, nextPlayer)) {
      changed = true;
    }
    return nextPlayer;
  });
  return changed ? next : base.slice();
}

