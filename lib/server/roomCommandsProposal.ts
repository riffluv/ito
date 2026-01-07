import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { normalizeProposal, prepareProposalInsert } from "@/lib/game/domain";
import type { RoomDoc } from "@/lib/types";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";

type ProposalAction = "add" | "remove" | "move";

const readProposal = (source: unknown): (string | null)[] => {
  if (!Array.isArray(source)) return [];
  return (source as (string | null | undefined)[]).map((value) =>
    typeof value === "string" && value.length > 0 ? value : null
  );
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export async function mutateProposal(params: {
  token: string;
  roomId: string;
  playerId: string;
  action: ProposalAction;
  targetIndex?: number | null;
}): Promise<"ok" | "noop" | "missing-deal"> {
  const uid = await verifyViewerIdentity(params.token);

  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const proposalRef = db.collection("roomProposals").doc(params.roomId);

  const targetIndex = typeof params.targetIndex === "number" ? params.targetIndex : -1;

  const result = await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) throw codedError("room_not_found", "room_not_found");
    const room = roomSnap.data() as RoomDoc;
    if (room.status !== "clue") return "noop" as const;
    const resolveMode = (room?.options as { resolveMode?: string } | undefined)?.resolveMode;
    if (resolveMode && resolveMode !== "sort-submit") return "noop" as const;

    const roundPlayers = Array.isArray(room?.deal?.players)
      ? (room.deal!.players as string[]).filter((value) => typeof value === "string" && value.trim().length > 0)
      : [];
    if (roundPlayers.length === 0) return "missing-deal" as const;
    if (!roundPlayers.includes(params.playerId)) return "missing-deal" as const;
    const maxCount = roundPlayers.length;

    // 誰でも並び替えできる仕様。ただし現在のラウンド参加者 or ホスト/作成者に限定して悪用を防ぐ
    const actorIsParticipant = roundPlayers.includes(uid);
    const actorIsHost = !room.hostId || room.hostId === uid || room.creatorId === uid;
    if (!actorIsParticipant && !actorIsHost) {
      throw codedError("forbidden", "forbidden", "actor_not_participant");
    }

    const proposalSnap = await tx.get(proposalRef);
    const proposalData = proposalSnap.exists ? (proposalSnap.data() as { proposal?: unknown; seed?: unknown }) : null;
    const roomSeed = typeof room?.deal?.seed === "string" ? room.deal.seed : null;
    const docSeed = typeof proposalData?.seed === "string" ? (proposalData?.seed as string) : null;

    let current = readProposal(proposalData?.proposal ?? room?.order?.proposal);
    if (docSeed && roomSeed && docSeed !== roomSeed) {
      current = [];
    }
    const roundSet = new Set(roundPlayers);
    current = current.map((id) => (typeof id === "string" && roundSet.has(id) ? id : null));

    let normalized: (string | null)[] | null = null;

    if (params.action === "add") {
      const insert = prepareProposalInsert(current, params.playerId, maxCount, targetIndex);
      if (insert.status === "noop") return "noop" as const;
      normalized = insert.normalized;
    } else if (params.action === "remove") {
      const index = current.findIndex((value) => value === params.playerId);
      if (index < 0) return "noop" as const;
      current[index] = null;
      normalized = normalizeProposal(current, maxCount);
    } else {
      const fromIndex = current.findIndex((value) => value === params.playerId);
      if (fromIndex < 0) return "noop" as const;
      const clampedIndex = clamp(targetIndex, 0, Math.max(0, maxCount - 1));
      const target = current[clampedIndex];
      if (typeof target === "string" && target !== params.playerId) {
        current[clampedIndex] = params.playerId;
        current[fromIndex] = target;
      } else {
        current[fromIndex] = null;
        if (clampedIndex >= current.length) current.length = clampedIndex + 1;
        current[clampedIndex] = params.playerId;
      }
      if (maxCount > 0 && current.length > maxCount) current.length = maxCount;
      normalized = normalizeProposal(current, maxCount);
    }

    const seedToUse = roomSeed ?? docSeed ?? null;
    tx.set(
      proposalRef,
      {
        proposal: normalized,
        seed: seedToUse,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.update(roomRef, {
      "order.proposal": normalized,
      lastActiveAt: FieldValue.serverTimestamp(),
      statusVersion: FieldValue.increment(1) as unknown as number,
    });
    return "ok" as const;
  });

  return result ?? "noop";
}

