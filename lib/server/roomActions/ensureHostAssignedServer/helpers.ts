import type { PlayerDoc } from "@/lib/types";

export type RoomUpdateMap = Record<string, unknown>;
export type PlayerDocLike = { id: string; data: () => PlayerDoc };

export function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function deriveCreatorUpdates(params: {
  existingCreatorId: string | null;
  existingCreatorName: string | null;
  currentHostId: string | null;
  roomHostName: string | null;
  fieldDelete: unknown;
}): RoomUpdateMap {
  const updates: RoomUpdateMap = {};
  if (!params.existingCreatorId && params.currentHostId) {
    updates.creatorId = params.currentHostId;
    if (params.roomHostName) {
      updates.creatorName = params.roomHostName;
    } else if (params.existingCreatorName === null) {
      updates.creatorName = params.fieldDelete;
    }
  }
  return updates;
}

export function isPlayerRegistered<T extends PlayerDocLike>(
  playerDocs: readonly T[],
  hostId: string | null
): boolean {
  if (!hostId) return false;
  return playerDocs.some((doc) => {
    if (doc.id === hostId) return true;
    const data = doc.data() as PlayerDoc;
    return typeof data?.uid === "string" && data.uid === hostId;
  });
}

export function findPlayerDocByUid<T extends PlayerDocLike>(
  playerDocs: readonly T[],
  uid: string
): T | null {
  return (
    playerDocs.find((doc) => doc.id === uid) ||
    playerDocs.find((doc) => {
      const data = doc.data() as PlayerDoc;
      return typeof data?.uid === "string" && data.uid === uid;
    }) ||
    null
  );
}

export function computeDedupeDeletes<T extends PlayerDocLike>(params: {
  playerDocs: readonly T[];
  uid: string;
  keepDocId: string;
}): string[] {
  const deletes: string[] = [];
  for (const doc of params.playerDocs) {
    if (doc.id === params.keepDocId) continue;
    const data = doc.data() as PlayerDoc;
    const sameUid = typeof data?.uid === "string" && data.uid === params.uid;
    if (sameUid || doc.id === params.uid) {
      deletes.push(doc.id);
    }
  }
  return deletes;
}

export function filterCanonicalPlayers<T extends PlayerDocLike>(params: {
  playerDocs: readonly T[];
  deleteDocIds: ReadonlySet<string>;
}): T[] {
  return params.playerDocs.filter((doc) => !params.deleteDocIds.has(doc.id));
}

export function shouldKeepExistingHost(params: {
  currentHostId: string | null;
  uid: string;
  hostStillRegistered: boolean;
  hostOnline: boolean;
}): boolean {
  return (
    !!params.currentHostId &&
    params.currentHostId !== params.uid &&
    params.hostStillRegistered &&
    params.hostOnline
  );
}

export function resolveEffectiveHostId(params: {
  currentHostId: string | null;
  hostStillRegistered: boolean;
  hostOnline: boolean;
}): string | null {
  return params.currentHostId && params.hostStillRegistered && params.hostOnline
    ? params.currentHostId
    : null;
}
