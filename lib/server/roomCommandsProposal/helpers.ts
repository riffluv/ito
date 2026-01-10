import type { RoomDoc } from "@/lib/types";

export type ProposalAction = "add" | "remove" | "move";

export function readProposal(source: unknown): (string | null)[] {
  if (!Array.isArray(source)) return [];
  return (source as (string | null | undefined)[]).map((value) =>
    typeof value === "string" && value.length > 0 ? value : null
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isResolveModeSortSubmit(room: RoomDoc): boolean {
  const resolveMode = (room?.options as { resolveMode?: string } | undefined)?.resolveMode;
  if (!resolveMode) return true;
  return resolveMode === "sort-submit";
}

export function deriveRoundPlayers(room: RoomDoc): string[] {
  const raw = Array.isArray(room?.deal?.players) ? (room.deal!.players as string[]) : [];
  return raw.filter((value) => typeof value === "string" && value.trim().length > 0);
}

export function isActorAllowedToMutateProposal(params: {
  uid: string;
  room: RoomDoc;
  roundPlayers: readonly string[];
}): boolean {
  const actorIsParticipant = params.roundPlayers.includes(params.uid);
  const actorIsHost = !params.room.hostId || params.room.hostId === params.uid || params.room.creatorId === params.uid;
  return actorIsParticipant || actorIsHost;
}

export function normalizeProposalForRound(params: {
  proposal: (string | null)[];
  roundPlayers: readonly string[];
  roomSeed: string | null;
  docSeed: string | null;
}): (string | null)[] {
  let current = params.proposal;
  if (params.docSeed && params.roomSeed && params.docSeed !== params.roomSeed) {
    current = [];
  }
  const roundSet = new Set(params.roundPlayers);
  return current.map((id) => (typeof id === "string" && roundSet.has(id) ? id : null));
}

